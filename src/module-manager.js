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

  /**
   * ModuleRegistry has no dependencies.
   */
  static get moduleDependencies() { return []; }

  constructor(options) {
    super('module-manager', options?.sequence || ConfigurationSource.DefaultSequence.MODULES);

    this.configurator = options?.configurator ?? new Configurator();

    this.configurator.registerConfigurationSource(this);

    this._modules = new Map();    // name -> { ModuleClass, dependencies, configurables }
    this._instances = new Map();      // name -> { instance, managed }

    // Self-register ourselves as a module
    this.registerInstance(this);
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
   * Register a module class.
   * A well-formed ModuleClass will either provide a moduleInfo static property containing multiple module
   * settings, or individual static properties for each setting.  For example, .moduleInfo.name or .moduleName.
   * Modules are stored internally via the kebab-cased version of their name.
   *
   * @param {Function} ModuleClass - Class or factory function with static metadata.
   * @param {object?} [options] - Optional module properties
   */
  register(ModuleClass, options) {
    if (typeof ModuleClass !== 'function') {
      throw new Error('ModuleClass must be a constructor function');
    }
    const moduleName = toKebabCase(options?.name ?? getModuleSetting(ModuleClass, 'name') ?? ModuleClass.name);

    if (!moduleName) {
      throw new Error('ModuleClass needs to be registered with a name')
    }

    if (this._modules.has(moduleName)) {
      throw new Error(`Module already registered: ${moduleName}`);
    }

    const isMainModule = options?.isMainModule ?? getModuleSetting(ModuleClass, 'isMain') ?? false;  // todo -figure out a better criteria

    const existingMainModule = this.getMainModule();

    if (isMainModule && existingMainModule) {
      throw new Error(`Cannot register "${moduleName}", a main module "${existingMainModule.name}" is already registered`);
    }

    let schema = this.configurator.schema.child(toCamelCase(moduleName));
    if (options?.category) {
      schema.exclusive(options.category);
    }
    let configurables = options?.configurables ?? getModuleConfigurables(ModuleClass) ?? [];
    let instance = options?.instance;

    // add fields to schema and compute dependencies
    processConfigurables(schema, configurables);

    const definition = { name: moduleName, ModuleClass, schema, managed: !!instance, dependencies: new Set()};

    schema.types.defineType(moduleName,
      (value, config, type) => {
        return this.resolve(value, config, type);
      },
      (value) => {
        return !!this._findInstanceModule(value);
      },
      {...options, module: true});

    let inject = options?.inject ?? getModuleSetting(ModuleClass, 'inject') ?? false;

    if (isMainModule) {
      definition.isMainModule = true;
    }
    if (inject) {
      definition.inject = true;
    }

    const provides = toKebabCase(options?.provides ?? getModuleSetting(ModuleClass, 'provides'));
    if (provides) {
      schema.exclusive(provides);
      let aliasModule = this._modules.get(provides);

      if (aliasModule && !aliasModule.providers instanceof Set) {
        throw new Error(`Cannot register ${moduleName} with conflicting provides alias ${provides}`);
      }

      if (!aliasModule) {
        definition.provides = provides;

        aliasModule = this.registerAlias(provides, (providerName, configuration, type) => {
          let m = this._modules.get(provides);
          for (let providerName of m.providers) {
            // return the first provider that seems to be configured
            // (providers are registered as exclusive, so the schema assignment should ensure
            // there is only one)
            if (configuration[toCamelCase(providerName)]) {
              return this.resolve(providerName, configuration, type);
            }
          }
          return undefined;
        });
        aliasModule.providers = new Set();
      }
      aliasModule.providers.add(moduleName);
    }

    this._modules.set(moduleName, definition);
    if (instance) {
      this._instances.set(moduleName, instance);
    }

    return definition;
  }

  /**
   * Register a pre-instantiated module instance with optional override name.
   * @param {Object} instance - Pre-created module instance.
   * @param {object?} [options] - Optional overrides
   */
  registerInstance(instance, options) {
    if (instance === null || typeof instance !== 'object') {
      throw new Error('Instance must be an object');
    }
    const ModuleClass = instance.constructor;

    return this.register(ModuleClass, {...options, instance});
  }

  registerAlias(alias, selection, options = {}) {

    let moduleName = toKebabCase(alias);

    if (alias === selection) {
      return; // could cause infinite recursion in get()
    }

    let instanceResolver;

    if (typeof selection === 'string') {
      instanceResolver = (moduleName, configuration, type) => {
        return this.resolve(selection, configuration, type);
      }
    }
    else if (typeof selection === 'function') {
      instanceResolver = (moduleName, configuration, type) => {
        // wrap the provided resolver so that we ensure it returns an instance (or undefined)
        let module = this._modules.get(toKebabCase(moduleName));
        if (module?.instance) {
          return module.instance;
        }

        let result = selection(moduleName, configuration, type);

        if (result === undefined) {
          return undefined;
        }

        if (result === alias) {
          // todo - make this more robust for longer cycles!
          throw new Error('dynamic resolution self-reference');
        }

        return this.resolve(result, configuration, type);
      }
    }
    else {
      throw new Error(`unsupported selector type for ${moduleName} alias`);
    }

    let module = { name: moduleName, instanceResolver, dependencies: new Set()};

    this.configurator.schema.types.defineType(moduleName,
      (value, config, type) => {
        return this.resolve(value, config, type);
      },
      (value) => {
        return !!this._findInstanceModule(value);
      },
      {...options, module: true});
    this._modules.set(moduleName, module);

    return module;
  }

  registerConstant(name, value) {
    const moduleName = toKebabCase(name);

    let module = { name: moduleName, value, dependencies: new Set()};

    this.configurator.schema.types.defineType(moduleName, () => value, v => { return v === value }, {module: true, lifecycle: false});
    this._modules.set(moduleName, module);
    return module;
  }

  resolve(request, config, type) {

    let moduleName;
    if (typeof request === 'string') {
      moduleName = toKebabCase(request);
    }
    else if (typeof request === 'function') {
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

    let module = this._modules.get(moduleName);

    if (!module) {
      return undefined;
    }

    if (module.instance) {
      return module.instance;
    }

    if (module.value) {
      return module.value;
    }

    if (module.instanceResolver) {
      // this is an alias module

      if (!config || !type) {
        throw new Error(`dynamic modules can only resolve during configuration`)
      }
      module.instance = module.instanceResolver(moduleName, config, type);

      if (!module.instance) {
        return undefined;
      }

      for (let m of this._modules.values()) {
        if (m.instance && m.instance === module.instance && m.name !== moduleName) {
          module.dependencies.add(m.name);
        }
      }
      return module.instance;
    }
    else if (module.ModuleClass) {
      // this is a class module
      module.instance = new module.ModuleClass();

      for (let [, field] of module.schema.getAllFieldPaths()) {
        let type = this.configurator.schema.types.getType(field.type);

        if (type?.options?.module) {
          module.dependencies.add(toKebabCase(field.type));
        }
      }
      return module.instance;
    }
    else {
      throw new Error(`unsupported module type ${moduleName}`);
    }
  }

  _findInstanceModule(instance) {
    for (let [moduleName, module] of this._modules) {
      if (module.instance === instance) {
        return module;
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
      if (!results.has(m.name) && !m.instanceResolver) {
        results.set(m.name, m.instance);
      }
    }
    for (let [moduleName] of this._modules) {
      walk(moduleName);
    }
    return results;
  }

  /*
      1. Configurable fields are loaded from Module definitions.
      2. Sometimes two modules are incompatible.  These can be identified by defining
         an exclusive schema category that only one group of configurables can fulfill.
      3. Sometimes module instantiation will be driven by the provided configuration.
      4. Therefore, we need to prevent incompatible configuration.
      5. We do this by defining a priority order to configuration data sources.
      6. Within any given source, it is illegal to configure incompatible settings.
      7. Within a sequence of sources, the highest numbered source wins, and will
         remove all incompatible lower-
      8. All configurations should be homologous with an "ideal config file"
         (basically the json config, with the extension of having some fields with
         module instances).
      9. In the ideal config file, each module name is a field in the root object
         with an object as a value.
      10. Each module's configurable field is a property within those objects.
      11. A module field with an empty object as its value is treated the same
          as if the module field was not defined at all.
      12. Some fields can be defined as adding to a global scope (top level of
          the ideal config file).
      13. The dependency graph implied by the loaded configuration drives what
          modules will be instantiated (not the other way around!)
      14. Field values are resolved at the very end of the process, allowing dynamic
          resolution.  Any value that fails to resolve (returns undefined) will be
          retried.  Value resolution is repeated until the set of resolved values is stable.
      15. Dynamic resolution has access to the (partial) configuration state mid-resolution.
          This needs to be implemented carefully to prevent inconsistent results.

   */


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

        return this.resolve(moduleName, configuration, type);
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
    const timeoutMillis = options?.timeoutMillis || LIFECYCLE_DEFAULT_TIMEOUT

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

    for (const [moduleName] of this.instances) {
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

    const instances = this.instances.values().filter(instance => typeof instance[methodName] === 'function');
    const promises = instances.map(instance => instance[methodName].apply(instance, ...args));

    return Promise.race(promises);
  }

  async initModules(config) {

    let i = this.instances;
    for (const [moduleName, instance] of i) {
      let def = this._modules.get(moduleName);

//      let moduleConfig = (def.isMainModule? config : config[toConstantCase(moduleName)]) ?? {};
      let moduleConfig = config[toCamelCase(moduleName)] ?? {};

      if (def.inject) {
        deepMerge(instance, moduleConfig)
      }
      await this.callWithTimeout(moduleName, 'init', {args: [moduleConfig]});
    }
  }


  async run(context) {

    try {
      const mainModule = this.getMainModule();

      let configureContext = {appName: mainModule?.name ?? 'app', ...context};

      let config = await this.configurator.configure(configureContext, true);

      // todo - loop over multiple main modules?

      if (mainModule) {
        // should we require that a main module is registered?
        this.resolve(mainModule.name);
      }

      await this.initModules(config);
      await this.invokeLifecycleMethod('start');
      try {
        await this.invokeMainMethod('main');
      }
      catch (error) {

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
