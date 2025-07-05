"use strict";

import { InternalError, TimeoutError } from './error.js';
import { setTimeout } from 'node:timers/promises';
import { Configurator } from './configurator.js';
import { deepMerge, toCamelCase, toConstantCase, toKebabCase, toPascalCase } from './utils.js';
import { ConfigurationSource } from './configuration-sources/configuration-source.js';

const LIFECYCLE_DEFAULT_TIMEOUT = 60 * 1000;

// todo - consider replacing "definition" with a formal Module class

/**
 * @module ModuleRegistry
 * Simple dependency injection container with lifecycle management.
 */
export class ModuleManager extends ConfigurationSource
{
  /**
   * ModuleRegistry module name for DI.
   */
  static get moduleName() { return 'module-manager'; }

  static get moduleInfo() {
    return {
      name: 'module-manager',
      configurables: [
        { field: 'lifecycleTimeoutMillis', type: 'number', description: 'Timeout for lifecycle methods', default: 60000, validator: '$positive', hidden: true, advanced: true },
      ],
      inject: true

    }
  }

  /**
   * @typedef ModuleManagerOptions
   * @property {number} [lifecycleTimeoutMillis] - Timeout for lifecycle methods.
   * @property {Configurator} [configurator] - Optional configurator instance to use.
   * @property {number} [sequence] - Optional sequence number override to use for configuration prioritization.
   * @property {string} [name] - Optional override name to use for this module.
   */

  /**
   * @typedef ModuleDefinition
   * @property {string} name - Name of the module.
   * @property {Set<string>} [dependencies] - List of module names that this module depends on.
   * @property {object} [instance] - Resolved singleton instance associated with the module
   *
   * @property {Function} [ModuleClass] - class or factory function with static metadata; presence indicates a "normal" module
   * @property {function} [resolver] - function to call that will resolve to a (different) module instance.  presence indicates a "resolver" module.
   *
   * @property {boolean} [inject] - True if this module requests configuration injection.
   * @property {boolean} [managed] - True if the module manager created the module instance (false if pre-instantiated)
   * @property {boolean} [isMain] - True if this module is the main module

   * @property {boolean} [lifecycle] - True if the module manager should call lifecycle methods on the instance.
   * @property {string} [config] - Set to "full" to pass the complete configuration to lifecycle methods.  The default is to only pass the module-specific portion.
   * @property {object} [schema] - Schema for this module.

   * @property {string} [provides] - Service that this module provides; a resolver module will be created to find a matching provider - todo support multiple
   * @property {Set<string>} [providers] - Used by resolver modules; the set of modules that provide a compatible service for resolution
   */

  /**
   * Create a new ModuleRegistry instance.
   *
   * @param {ModuleManagerOptions} [options]
   */
  constructor(options) {
    super('module-manager', options?.sequence || ConfigurationSource.DefaultSequence.MODULES);

    /** @type {number} - Timeout for lifecycle methods.  Defaults to 60 seconds. */
    this.lifecycleTimeoutMillis = LIFECYCLE_DEFAULT_TIMEOUT;

    /** @type {Configurator} */
    this._configurator = options?.configurator ?? new Configurator();
    this._configurator.registerConfigurationSource(this);

    /** @type {Map<string, ModuleDefinition>} - main storage for modules.  Keys are kebab-cased module names. */
    this._modules = new Map();    // name -> { ModuleClass, dependencies, configurables }

    // Self-register ourselves as a module
    this.registerInstance(this, {lifecycle: false});
  }

  /** @type {Types} */
  get types() {
    return this.configurator.schema.types;
  }

  /** @type {Configurator} - only a getter, it's read-only after construction */
  get configurator() {
    return this._configurator;
  }

  // todo - allow multiple main modules (if we even continue to support them at all?)
  //        (elsewhere in the code it assumes there may be more than one)
  getMainModule() {
    for (let [name, definition] of this._modules) {
      if (definition.isMainModule) {
        return definition;
      }
    }
    return undefined;
  }

  /**
   * Get a module definition.  Public, but rarely needed.
   *
   * @param {string} name - module name
   * @returns {ModuleDefinition|undefined}
   */
  getModule(name) {
    return this._modules.get(toKebabCase(name));
  }

  /**
   * @typedef {object} ModuleOptions - optional (override) properties for registering a module.  Prefer the ModuleClass static metadata when feasible.
   * @property {string} [name] - Name of the module.  If not provided, the module name will be derived from module settings or the class name.
   * @property {Array<object>} [configurables] - List of configurable fields and children for schema definition.*
   * @property {string} [provides] - If specified, this module can fulfill a provider alias.*
   * @property {boolean} [lifecycle] - If false, this module will not have lifecycle methods called.
   * @property {string} [config] - If "full", the full configuration will be passed to init(), otherwise only the module specific portion.
   * @property {boolean} [isMain] - If true, this module will be registered as the main module.  Only one main module can be registered.
   * @property {boolean} [inject] - If true, this module requests configuration injection.  The lack of an init() method + configurables implies inject=true.
   * @property {object} [instance] - Pre-created instance of the module.  If provided, the module will be registered as a pre-instantiated module.  Prefer registerInstance.
   */

  /**
   * Register a module with a ModuleClass that can be instantiated via a no-arguments constructor
   *
   * A well-formed ModuleClass will either provide a moduleInfo static property containing multiple module
   * settings, or individual static properties for each setting.  For example, .moduleInfo.name or .moduleName.
   *
   * Modules are stored internally keyed by the kebab-cased version of their name.
   * todo - allow multiple "provides"; array/set/etc.
   *        provides = new Set(provides == null ? [] : [provides].flat());
   *
   * @param {Function} ModuleClass - Class or factory function with static metadata.
   * @param {ModuleOptions} [options] - Optional module properties
   */
  register(ModuleClass, options) {
    if (typeof ModuleClass !== 'function') {
      throw new Error('ModuleClass must be a constructor function');
    }
    const moduleName = toKebabCase(options?.name ?? getModuleSetting(ModuleClass, 'name') ?? ModuleClass.name);

    if (!moduleName) {
      throw new Error('ModuleClass needs to be registered with a name');  // should be impossible, but just in case...
    }

    if (this._modules.has(moduleName)) {
      if (this._modules.get(moduleName).ModuleClass !== ModuleClass) {
        throw new Error(`Module ${moduleName} already registered with a different ModuleClass`);
      }
      return this;
    }

    const isMainModule = options?.isMain ?? getModuleSetting(ModuleClass, 'isMain') ?? typeof ModuleClass.prototype['main'] === 'function' ?? false;

    const existingMainModule = this.getMainModule();

    if (isMainModule && existingMainModule) {
      // todo - consider allowing multiple "main" modules; currently tricky as we use the main module for the app name
      throw new Error(`Cannot register "${moduleName}", a main module "${existingMainModule.name}" is already registered`);
    }

    const instance = options?.instance;

    let configurables = [];
    if (options?.configurables === 'auto' || getModuleSetting(ModuleClass, 'configurables') === 'auto') {
      configurables = guessModuleConfigurables(ModuleClass);
    }
    else {
      configurables = options?.configurables ?? getModuleConfigurables(ModuleClass) ?? [];
    }
    const needsInjection = configurables.length > 0 && typeof ModuleClass.prototype['init'] !== 'function';
    const inject = options?.inject ?? getModuleSetting(ModuleClass, 'inject') ?? needsInjection
    const lifecycle = options?.lifecycle ?? getModuleSetting(ModuleClass, 'lifecycle') ?? true;
    const config = options?.config ?? getModuleSetting(ModuleClass, 'config') ?? 'module';

    /** @type {ModuleDefinition} */
    const moduleDefinition = { name: moduleName, ModuleClass, dependencies: new Set(), instance, managed: !!instance, isMainModule, inject, lifecycle, config };

    const provides = toKebabCase(options?.provides ?? getModuleSetting(ModuleClass, 'provides'));

    let schemaOptions = {condition: options?.condition ?? (() => (this._modules.get(moduleName).instance !== undefined))};
    if (provides) {
      moduleDefinition.provides = provides;
//    todo - support multiple provides?
      this.registerProviderResolver(provides, moduleName);  // create a new provider resolver, or add this module as a provider to the existing one
    }

    moduleDefinition.schema = this.configurator.schema.child(toCamelCase(moduleName), schemaOptions);

    // add fields to schema and compute dependencies
    processConfigurables(moduleDefinition.schema, configurables);

    moduleDefinition.schema.types.defineType(moduleName,
      (value) => {
        let instance = this.resolve(value);

        if (!instance) {
          return undefined;
        }

        let instanceModule = this._findInstanceModule(instance);

        if (!instanceModule) {
          throw new Error(`Resolved instance for ${moduleName} is not associated with a registered module!`)
        }
        if (instanceModule.name !== moduleName) {
          throw new Error(`Resolved ${instanceModule.name} instance is incompatible with ${moduleName} type`);
        }
        return instance;
      },
      {...options, module: true, hidden: true});

    if (instance) {
      moduleDefinition.instance = instance;
    }
    this._modules.set(moduleName, moduleDefinition);

    return this;
  }

  /**
   * Register a pre-instantiated module instance with optional override name.
   * @param {Object} instance - Pre-created module instance.
   * @param {ModuleOptions} [options] - Optional overrides
   */
  registerInstance(instance, options) {
    if (instance === null || typeof instance !== 'object') {
      throw new Error('Instance must be an object');
    }
    let ModuleClass = instance.constructor;

    if (typeof ModuleClass !== 'function' || instance.constructor === Object) {
      if (!options?.name) {
        throw new Error('A module name is required for this instance');
      }
      ModuleClass = () => instance;
      ModuleClass.prototype = Object.getPrototypeOf(instance);
      Object.defineProperty(ModuleClass, 'name', {value: options.name, writable: false, enumerable: false, configurable: true});
    }

    return this.register(ModuleClass, {...options, instance});
  }

  /**
   * Register a Provider Resolver module
   *
   * Provider Resolvers are a special type of module that dynamically resolve to the first instantiated instance of
   * an existing module with a matching "provides" clause.  This is useful for cases where multiple modules
   * provide the same service, but the choice of which module to use is not known until runtime.
   *
   * All registered modules create a new associated schema type that can be referenced as a field type for configuration.
   * Each schema type provides its own resolution logic for mapping a raw input value to a final assigned value.
   * For example, the "boolean" schema type will accept a variety of "truthy" or "falsey" values, but always outputs an
   * explicit true or false.
   *
   * Configuration is an iterative process, and to allow for complex dynamic types, the current configuration
   * state is provided to type resolvers.  This allows for resolution of values that are based on evaluating other
   * peer configuration fields that may or may not be set yet, due to arbitrary assignment order.  To facilitate
   * dynamic resolution, the convention is that type resolvers return "undefined" if they cannot (currently)
   * resolve a value.  Configuration assignment will iterate and keep retrying unresolved assignments until they
   * either resolve, or no new assignments have succeeded (i.e. the configuration is at least stable, if not complete).
   *
   * To make matters even more complex (but flexible), field assignments themselves can be made dynamic by making
   * the assigned value a function.  As multiple configuration sources may contribute assignments, and some may be
   * overridden or skipped or suppressed, it is sometimes useful to delay evaluation of a value until the assignment
   * is actually being applied to the configuration.  For example, you could assign a string value directly, or assign
   * a function that returns a string.  This doesn't matter much for simple types, but if there is a side effect
   * of the value computation, delaying evaluation until assignment is important.  This is the case for module
   * resolution, where we don't want to instantiate any modules that are not actually referenced.
   *
   * Thus, the data flow of a configurable field from source to the final configuration object proceeds as follows:
   *   (raw input) -> (extract assignment) -> (resolve via type resolver) -> (validate) -> (output to config)
   *
   * The key difference between the two styles of dynamic resolution is the first is dynamic per-assignment,
   * and the second is dynamic per-type.
   *
   * Leveraging this system, the schema types created for modules have resolvers that accept a variety of inputs,
   * such as a module name, a module instance... or a function that resolves to a module name or instance.  In any case,
   * the output is always either a module instance or undefined.
   *
   * At the beginning of the module initialization lifecycle, default assignments are synthesized for all referenced
   * module types discovered in the entire configuration schema closure.  Each assignment is a deferred value that
   * simply resolves to the name of the module.  The module type resolver will then take over and map this name to an
   * actual module instance (either by returning the current instance as a singleton, or by instantiating a new instance).
   *
   * In the case when the name corresponds to a Provider Resolver, the synthetic default module assignment cannot
   * succeed at first, because there is no module class to instantiate, and thus the type resolver returns undefined.
   *
   * To fully populate the configuration successfully, a higher-precedence configuration source must provide an
   * assignment that sets a Provider Resolver module type field to the name of a concrete implementation module that has
   * a matching "provides" clause.  (Note: as a special case, if only a single concrete implementation module matches
   * a given "provides" clause, it is pre-resolved as the default without requiring a configuration assignment!)
   *
   * This higher precedence assignment then triggers the resolution of the concrete class, which returns an instance.
   * The type resolver for Provider Resolvers are similar to regular module type resolvers, except that they save
   * the instance from the indirectly referenced provider module instead of instantiating their own.  This allows
   * any other reference to the same Provider Resolver (e.g. any default assignments) to now resolve to the same
   * instance.
   *
   * One final note: providers default to being mutually exclusive, so the configuration schema for each provider
   * module is set up such that all fields have a condition that the assignments will only be evaluated if the
   * corresponding module has been instantiated.  This ensures that configuration fields of unused providers are not
   * populated (which would be bad if they reference unnecessary modules!)
   *
   * @param {string} moduleName - module name of the provider resolver
   * @param {string} [provider] - optional set of module names that are legal resolution values
   */
  registerProviderResolver(moduleName, provider) {
    if (!moduleName) {
      throw new Error('Provider Resolver Module must be registered with a name');
    }
    if (!provider) {
      throw new Error('Provider Resolver Module must be associated with at least one provider');
    }
    moduleName = toKebabCase(moduleName);  // normalize!

    let moduleDefinition = this._modules.get(moduleName);

    if (moduleDefinition) {
      // todo - create an explicit moduleType property instead of looking implicitly at providers?
      if (!moduleDefinition.providers) {
        throw new Error(`Cannot register ${moduleName} as a provider resolver because it already exists as a regular module`);
      }
      moduleDefinition.providers.add(provider);
      return this;
    }

    this.registerResolver(moduleName, (value) => {
      let providerInstance = this.resolve(value);
      if (providerInstance) {
        let providerModule = this._findInstanceModule(providerInstance);

        if (!providerModule) {
          throw new Error(`Resolved provider for ${moduleName} is not associated with a registered module!`)
        }
        if (providerModule.provides !== moduleName) {
          throw new Error(`Resolved ${providerModule.name} instance does not provide ${moduleName}`);
        }
        if (!moduleDefinition.providers.has(providerModule.name)) {
          throw new Error(`Module ${providerModule.name} was somehow not registered as a provider for ${moduleName}`);  // unlikely but implies a bug
        }
      }
      else if (moduleDefinition.providers.size === 1) {
        let [providerName] = moduleDefinition.providers.values()
        providerInstance = this.resolve(providerName);
      }
      return providerInstance;
    }, {

    })
    moduleDefinition = this._modules.get(moduleName);
    moduleDefinition.providers = new Set([provider]);
    return this;
  }

  /**
   * @param {string} name
   * @param {function} resolver
   * @param {ModuleOptions} [moduleOptions]
   * @returns {ModuleManager}
   */
  registerResolver(name, resolver, moduleOptions = {}) {
    const moduleName = toKebabCase(name);
    if (!moduleName) {
      throw new Error('Resolver Module must be registered with a name');
    }
    if (this._modules.has(moduleName)) {
      throw new Error(`Module ${moduleName} already registered`)
    }
    if (typeof resolver !== 'function') {
      throw new Error('Resolver Module needs a resolver function');
    }
    if (moduleOptions.ModuleClass || moduleOptions.provides || moduleOptions.managed || moduleOptions.inject) {
      throw new Error('Resolver module cannot be registered with class module options');
    }

    /** @type {ModuleDefinition} */
    const moduleDefinition = { name: moduleName, dependencies: new Set(), resolver, ...moduleOptions, lifecycle: false };

    this.configurator.schema.types.defineType(moduleName,
      (value, config, type) => {

        let results = resolver(value, config, type);

        const instance = this.resolve(results);

        if (instance) {
          if (!moduleDefinition.instance) {
            // newly resolved.  save and add dependency.

            let instanceModule = this._findInstanceModule(instance);
            if (!instanceModule) {
              throw new Error(`Resolved instance for ${moduleName} is not associated with a registered module!`)
            }
            moduleDefinition.instance = instance;
            moduleDefinition.dependencies.add(instanceModule.name);
          }

          if (moduleDefinition.instance !== instance) {
            throw new Error(`Resolver Module ${moduleName} instance resolution conflict!`);
          }
          return moduleDefinition.instance;
        }
        else {
          if (moduleDefinition.instance) {
            // todo - we're in weird territory here; why is the value not resolving, yet we already have an instance?
            //        not sure if this should be an error or not.  breakpoint and try to force it to happen.
            //        (duplicate assignment but with a totally invalid value?)

            return moduleDefinition.instance;
          }
        }
        return undefined;
      },
      {module: true, valueDescription: 'module-name'/* fixme , valueDescription: () => { return Array.from(moduleDefinition.providers).join('|') }}*/ }
    );
    this._modules.set(moduleName, moduleDefinition);
    return this;
  }

  registerConstant(name, value) {
    const moduleName = toKebabCase(name);

    /** @type {ModuleDefinition} */
    let module = { name: moduleName, value, dependencies: new Set(), lifecycle: false};

    this.configurator.schema.types.defineType(moduleName, () => value, {module: true});
    this._modules.set(moduleName, module);
    return this;
  }

  /**
   * Resolve a module instance (or constant value) from a requested input that may be a module name, instance,
   * or function.  If the module was previously resolved, it will return the cached singleton instance.
   * Otherwise, if the module has a ModuleClass, it will be used to construct a new instance.  If the module provides
   * indirection to a different module, that one will be resolved and returned.
   *
   * @param {string|function|object} request
   * @returns {object|undefined|*}
   */
  resolve(request) {

    if (request === undefined) {
      return undefined;
    }

    let moduleName;
    if (typeof request === 'string') {
      moduleName = toKebabCase(request);
    }
    else if (typeof request === 'function') {
      // assumed to be a module class constructor
      moduleName = toKebabCase(getModuleSetting(request, 'name') ?? request.name);
    }
    else if (typeof request === 'object') {
      // todo - I don't think this is quite right; should be able to resolve an instance that
      //        was defined with externally provided name/settings

      const ModuleClass = request.constructor;
      moduleName = toKebabCase(getModuleSetting(ModuleClass, 'name') ?? ModuleClass.name);
    }
    if (!moduleName) {
      throw new Error(`cannot resolve instance for ${request}`);
    }

    let moduleDefinition = this._modules.get(moduleName);

    if (!moduleDefinition) {
      throw new Error(`Module ${moduleName} not registered`);
//      return undefined;
    }

    if (moduleDefinition.instance) {
      return moduleDefinition.instance;
    }

    // fixme - constant modules break the contract
    if (moduleDefinition.value) {
      return moduleDefinition.value;
    }

    if (moduleDefinition.ModuleClass) {
      // this is a class module
      moduleDefinition.instance = new moduleDefinition.ModuleClass();

      // todo - should we be doing this here?  or should we be doing it in the register call?
      for (let [, field] of moduleDefinition.schema.getAllFieldPaths()) {
        let type = this.configurator.schema.types.getType(field.type);

        if (type?.options?.module) {
          moduleDefinition.dependencies.add(toKebabCase(field.type));
        }
      }
      return moduleDefinition.instance;
    }
    else if (moduleDefinition.resolver) {
      return undefined;
    }
    else if (moduleDefinition.providers) {
      return undefined;
    }
    else {
      throw new Error(`unsupported module type ${moduleName}`);
    }
  }

  _findInstanceModule(instance) {
    for (let [moduleName, moduleDefinition] of this._modules) {
      //
      if (moduleDefinition.instance === instance && !moduleDefinition.providers) {
        return moduleDefinition;
      }
    }
    return undefined;
  }

  get instances() {
    let results = new Map();
    let visited = new Set();

    const walk = moduleName => {
      let m = this._modules.get(moduleName);
      if (!m || !m.instance || visited.has(m.name)) {
        return;
      }
      visited.add(m.name);
      for (let dep of m.dependencies) {
        walk(dep);
      }
      if (!results.has(m.name) && !m.resolver) {
        results.set(m.name, m.instance);
      }
    }
    for (let [moduleName] of this._modules) {
      walk(moduleName);
    }
    return results;
  }

  get instanceModules() {
    let results = new Map();
    for (let [moduleName] of this.instances) {
      results.set(moduleName, this._modules.get(moduleName));
    }
    return results;
  }

  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @returns {Promise<Object>} Parsed configuration object
   */
  async load(schema, context) {

    const fieldPaths = schema.getAllFieldPaths();
    const fieldValues = new Map();

    for (let [path, field] of fieldPaths) {
      let type = schema.types.getType(field.type);

      if (!type?.options?.module) {
        continue;
      }

      const moduleName = toKebabCase(field.type);

      let valueLambda = (configuration, type) => {
        // we want to delay resolution of the module so that if this assignment
        // gets pruned, we didn't instantiate something needlessly.

        //return this.resolve(moduleName, configuration, type);
        return moduleName
        // maybe just "return moduleName" and let the type resolver do the heavy lifting?
      }
      fieldValues.set(path, valueLambda);
    }
    return fieldValues;
  }


  async callWithTimeout(moduleName, methodName, options) {
    const instance = this.resolve(moduleName);

    let instanceFunction = instance[methodName];

    if (!instanceFunction) {
      return;
    }

    const description = {}.toString.call(instanceFunction);
    if (description !== "[object Function]" && description !== "[object AsyncFunction]") {
      throw new Error(`${methodName} is not a function`)
    }

    const cancelTimeout = new AbortController();
    const cancelTask = new AbortController();
    const timeoutMillis = options?.timeoutMillis || this.lifecycleTimeoutMillis;

    function timeout() {
      const start = process.hrtime.bigint();
      return setTimeout(timeoutMillis, undefined, {signal: cancelTimeout.signal}).then(() => {
        cancelTask.abort();
        const duration = Number(process.hrtime.bigint() - start) / 1e6;

        throw new TimeoutError(`"${methodName}" lifecycle timeout for ${moduleName}`, {duration});
      });
    }

    const args = options?.args ?? [];
    function task() {
      const callArgs = [...args, {signal: cancelTask.signal}];

      const executeAsync = async () => {
        return instanceFunction.apply(instance, callArgs);
      };
      return executeAsync().finally(() => {
        cancelTimeout.abort();
      });
    }

    return Promise.race([task(), timeout()]);
  }

  async invokeLifecycleMethod(methodName, options) {

    /** @type(Set<Promise<void>>) */
    const inProgress = new Set();

    for (const [moduleName, moduleDefinition] of this.instanceModules) {
      if (!moduleDefinition.lifecycle) {
        continue;
      }
      const p = this.callWithTimeout(moduleName, methodName, options);

      inProgress.add(p);
      p.finally(() => { inProgress.delete(p)})
    }
    // todo - think about this, it's kind of weird.
    while (inProgress.size > 0) {
      await Promise.all(inProgress.values());
    }
  }

  async invokeMainMethod(methodName, options) {
    const args = options?.args ?? [];

    // note - direct iterator filter requires node 22, so we use Array.from to allow us to support node 20
    const instances = Array.from(this.instances.values()).filter(instance => typeof instance[methodName] === 'function');
    const promises = Array.from(instances.map(instance => instance[methodName].apply(instance, ...args)));
    if (promises.length === 0) {
      return;
    }
    return Promise.race(promises);
  }

  async initModules(config) {

    for (const [moduleName, moduleDefinition] of this.instanceModules) {
      if (!moduleDefinition.lifecycle) {
        continue;
      }

//      let moduleConfig = (def.isMainModule? config : config[toConstantCase(moduleName)]) ?? {};
      let moduleConfig = config[toCamelCase(moduleName)] ?? {};

      if (moduleDefinition.inject) {
        deepMerge(moduleDefinition.instance, moduleConfig)
      }

      let configArgument = (moduleDefinition.config === 'full')? config : moduleConfig;

      await this.callWithTimeout(moduleName, 'init', {args: [configArgument], timeoutMillis: this.lifecycleTimeoutMillis});
    }
  }


  async run(context = {}) {

    try {
      const mainModule = this.getMainModule();
      if (mainModule) {
        // should we require that a main module is registered?
        this.resolve(mainModule.name);
      }

      let configureContext = {appName: mainModule?.name ?? 'app', ...context};
      let config = await this.configurator.configure(configureContext, true);

      // todo - loop over multiple main modules?

      await this.initModules(config);
      await this.invokeLifecycleMethod('start');
      try {
        await this.invokeMainMethod('main');
      }
      catch (error) {
        console.error(error);
      }
      await this.invokeLifecycleMethod('stop');
      await this.invokeLifecycleMethod('terminate');
    }
    catch (error) {
      console.error(error);
    }

  }

}

function processConfigurables(schema, configurables) {
  for (let configurable of configurables) {
    let c = {...configurable};

    if (configurable.field) {
      if (!configurable.type) {
        c.type = 'string';
      }
      else if (typeof configurable.type === 'function') {
        const moduleName = toKebabCase(getModuleSetting(configurable.type, 'name') ?? configurable.type?.name );

        if (!moduleName) {
          throw new Error('configurable module type needs a name')
        }
        c.type = moduleName;
      }
      else {
        c.type = toKebabCase(configurable.type);
      }

      schema.field(configurable.field, c)

//      if (configurable.type === 'module') {
//        dependencies.add(configurable.moduleName ?? toKebabCase(configurable.field));
//      }
    }
    else if (configurable.child) {
      let childSchema = schema.child(configurable.child, configurable);
      processConfigurables(childSchema, configurable.configurables);
    }
    // todo - handle errors and weird values
  }
//  return dependencies;
}

function getModuleSetting(ModuleClass, setting) {
  let currentClass = ModuleClass;

  while (currentClass) {

    let directProperty = `module${toPascalCase(setting)}`;
    let moduleProperty = toCamelCase(setting);

    let settingValue = currentClass[directProperty] ?? currentClass.moduleInfo?.[moduleProperty];

    if (settingValue) {
      return settingValue;
    }

    currentClass = Object.getPrototypeOf(currentClass);

    if (currentClass === Function.prototype || currentClass === null) {
      break;
    }
  }
  return undefined;
}

function getModuleConfigurables(ModuleClass) {
  let currentClass = ModuleClass;

  let configurableMap = new Map();

  while (currentClass) {

    let classConfigurables = currentClass['moduleConfigurables'] ?? currentClass.moduleInfo?.['configurables'];

    if (classConfigurables && classConfigurables.length) {
      for (let configurable of classConfigurables.reverse()) {
        let key;
        if (configurable.field) {
          key = `field:${configurable.field}`;
        }
        else if (configurable.child) {
          key = `child:${configurable.child}`;
        }

        if (key) {
          if (!configurableMap.has(key)) {
            configurableMap.set(key, configurable);
          }
        }
      }
    }
    currentClass = Object.getPrototypeOf(currentClass);

    if (currentClass === Function.prototype || currentClass === null) {
      break;
    }
  }

  let configurables = [...configurableMap.values()];

  return configurables.length ? configurables.reverse() : undefined;
}

function guessModuleConfigurables(ClassConstructor) {
  const fields = [];
  const processedFields = new Set();

  // Helper function to parse class source for field declarations and assignments
  function parseClassFields(classSource) {
    const fieldAssignments = [];

    // Parse class field declarations (class Test { foo = "hi"; bar = 123; })
    const classFieldRegex = /^\s*(\w+)\s*=\s*([^;,\n}]+)/gm;
    let match;

    while ((match = classFieldRegex.exec(classSource)) !== null) {
      const fieldName = match[1];
      const valueStr = match[2].trim();

      // Skip if it's a private field (starts with underscore or #)
      if (fieldName.startsWith('_') || fieldName.startsWith('#')) continue;

      // Skip constructor, methods, getters, setters
      if (fieldName === 'constructor' ||
          classSource.includes(`${fieldName}(`) ||
          classSource.includes(`get ${fieldName}`) ||
          classSource.includes(`set ${fieldName}`)) {
        continue;
      }

      const type = determineTypeFromValue(valueStr);
      fieldAssignments.push({ field: fieldName, type });
    }

    return fieldAssignments;
  }

  // Helper function to parse constructor source for field assignments
  function parseConstructorFields(constructorSource) {
    const fieldAssignments = [];

    // Match this.field = value patterns
    const assignmentRegex = /this\.(\w+)\s*=\s*([^;,\n}]+)/g;
    let match;

    while ((match = assignmentRegex.exec(constructorSource)) !== null) {
      const fieldName = match[1];
      const valueStr = match[2].trim();

      // Skip if it's a private field (starts with underscore)
      if (fieldName.startsWith('_')) continue;

      const type = determineTypeFromValue(valueStr);
      fieldAssignments.push({ field: fieldName, type });
    }

    return fieldAssignments;
  }

  // Helper function to determine type from assignment value string
  function determineTypeFromValue(valueStr) {
    if (valueStr === 'null' || valueStr === 'undefined') {
      return null;
    } else if (valueStr === 'true' || valueStr === 'false') {
      return 'boolean';
    } else if (/^['"`].*['"`]$/.test(valueStr)) {
      return 'string';
    } else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
      return 'number';
    } else if (valueStr === '[]') {
      return 'array';
    } else if (valueStr === '{}') {
      return 'object';
    } else if (valueStr.includes('new Date')) {
      return 'date';
    } else if (valueStr.includes('new Array') || valueStr.includes('Array(')) {
      return 'array';
    } else if (valueStr.includes('new Object') || valueStr.includes('Object(')) {
      return 'object';
    }
    return null;
  }

  // Helper function to check if a field is writable
  function isWritableField(obj, fieldName) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, fieldName);
    if (!descriptor) return true; // Default behavior for regular properties

    // Check if it's a setter-only property or has a setter
    if (descriptor.set && !descriptor.get) return true;
    if (descriptor.set && descriptor.get) return true;

    // Check if it's a regular writable property
    return descriptor.writable !== false;
  }

  // Process the class hierarchy
  let currentClass = ClassConstructor;

  while (currentClass && currentClass.name) {
    try {
      const classSource = currentClass.toString();

      // Parse class field declarations (e.g., class Test { foo = "hi" })
      const classFields = parseClassFields(classSource);

      // Parse constructor assignments (e.g., this.bar = "hello")
      const constructorFields = parseConstructorFields(classSource);

      // Combine all fields from this class level
      const allFields = [...classFields, ...constructorFields];

      // Add fields from this level of the hierarchy
      allFields.forEach(({ field, type }) => {
        if (!processedFields.has(field)) {
          processedFields.add(field);

          // Check if the field is writable by examining prototype
          const isWritable = isWritableField(currentClass.prototype, field);

          if (isWritable) {
            const fieldObj = { field };
            if (type) {
              fieldObj.type = type;
            }
            fields.push(fieldObj);
          }
        }
      });

      // Check for getter/setter pairs on prototype
      const prototypeProps = Object.getOwnPropertyNames(currentClass.prototype);
      prototypeProps.forEach(prop => {
        if (prop === 'constructor' || prop.startsWith('_') || processedFields.has(prop)) {
          return;
        }

        const descriptor = Object.getOwnPropertyDescriptor(currentClass.prototype, prop);
        if (descriptor && descriptor.set) {
          processedFields.add(prop);

          // Try to infer type from getter if available
          let type = null;
          if (descriptor.get) {
            try {
              const getterSource = descriptor.get.toString();
              // Simple pattern matching for return statements
              if (getterSource.includes('return ""') || getterSource.includes("return ''")) {
                type = 'string';
              } else if (getterSource.includes('return 0') || getterSource.includes('return 1')) {
                type = 'number';
              } else if (getterSource.includes('return true') || getterSource.includes('return false')) {
                type = 'boolean';
              } else if (getterSource.includes('return []')) {
                type = 'array';
              } else if (getterSource.includes('return {}')) {
                type = 'object';
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          const fieldObj = { field: prop };
          if (type) {
            fieldObj.type = type;
          }
          fields.push(fieldObj);
        }
      });

    } catch (error) {
      // Skip this class if we can't analyze it
      console.warn(`Could not analyze class ${currentClass.name}:`, error.message);
    }

    // Move up the prototype chain
    currentClass = Object.getPrototypeOf(currentClass);
  }

  return fields;
}
