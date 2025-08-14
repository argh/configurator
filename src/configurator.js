import { ConfigurationSchema } from './configuration-schema.js';
import {
  ConfigurationSource,
  CommandLineSource,
  SchemaDefaultsSource,
  EnvironmentSource,
  ObjectSource,
  JsonFileSource
} from './configuration-sources/index.js';
import { ConfiguratorError } from './configurator-error.js';
import { ValidatorRegistry } from './validator-registry.js';
import { TypeRegistry } from './type-registry.js';
import { deepAssign } from './utils.js';

const MODULE_INFO = {
  name: 'configurator'
}

export class Configurator {
  /**
   * @typedef {Object} ConfiguratorOptions
   * @property {ConfigurationSchema} [schema]
   * @property {TypeRegistry} [types]
   * @property {ValidatorRegistry} [validators]
   * @property {Array<ConfigurationSource>} [sources]
   * @property {string} [configField] - name of the field to use for the config file path
   * @property {string} [configFlag] - flag to use for the config file path
   * @property {string} [configDescription] - description to use for the config file path
   * @property {string} [configValueDescription] - description to use for the config file path value
   * @property {string} [configContextFieldName] - name of the field to pass in the context for source propagation
   * @property {object} [defaults] - optional ObjectSource configuration source data to use as defaults
   */

  /**
   * Create a new Configurator
   * @param {ConfiguratorOptions} [options]
   */
  constructor(options = {}) {
    this._schema = options.schema ?? new ConfigurationSchema();
    this._types = options.types ?? new TypeRegistry();
    this._validators = options.validators ?? new ValidatorRegistry();
    this._sources = options.sources;

    let configField = options.configField ?? 'config';
    let configFlag = options.configFlag ?? 'C';
    let configDescription = options.configDescription ?? 'load configuration from file';
    let configValueDescription = options.configValueDescription ?? 'path';

    let configContextFieldName = options.configContextFieldName ?? options.configField ?? 'config';

    if (options.configField) {
      this._schema.field(configField, {
        flagHint: configFlag,
        validator: '$file',
        context: configContextFieldName,
        description: configDescription,
        valueDescription: configValueDescription
      });
    }

    if (!this._sources) {
      this._sources = [];
      this.registerConfigurationSource(new SchemaDefaultsSource());                                     // system/schema defaults
      this.registerConfigurationSource(new ObjectSource({contextFieldName: 'defaults'}));  // app defaults
      this.registerConfigurationSource(new EnvironmentSource());
      this.registerConfigurationSource(new CommandLineSource());

      this.registerConfigurationSource(new JsonFileSource({
        contextFieldName: configContextFieldName
      }))
      this.registerConfigurationSource(new ObjectSource({contextFieldName: 'overrides', sequence: ConfigurationSource.DefaultSequence.OVERRIDES}));
    }

    this.context = {};

    if (options.defaults) {
      this.context['defaults'] = options.defaults; // app defaults; todo - rename to avoid confusion?
    }

  }

  /**
   * Register a configuration source with this Configurator
   * @param {ConfigurationSource} source
   */
  registerConfigurationSource(source) {
    if (!(source instanceof ConfigurationSource)) {
      throw new ConfiguratorError('Configurator configuration source must be an instance of ConfigurationSource');
    }
    this._sources.push(source);
    return this;
  }

  /**
   * List of configuration sources registered with this configurator
   * @returns {Array<ConfigurationSource>}
   */
  get sources() {
    return this._sources;
  }

  static get moduleInfo() { return MODULE_INFO }

  /**
   * Schema being used by this Configurator
   * @returns {ConfigurationSchema}
   */
  get schema() {
    return this._schema;
  }

  /**
   * Validator registry used by this Configurator
   * @returns {ValidatorRegistry}
   */
  get validators() {
    return this._validators;
  }

  /**
   * Type registry used by this Configurator
   * @returns {TypeRegistry}
   */
  get types() {
    return this._types;
  }

  /**
   * Build a configuration object using the defined sources and schema
   * @param {object} context - extra information to provide to sources
   * @param {boolean} strict - if false, unknown fields are ignored; if true, an error is thrown
   * @returns {Promise<Object>} - validated configuration object
   */
  async configure(context, strict = true) {

    // todo - deepMerge?
    const mergedContext = Object.assign({}, this.context, context)

    // sort sources by sequence (processing priority)
    let sources = this.sources
                      .map((source, index) => ({ source, index }))
                      .sort((a, b) => {
                        const seqA = a.source.sequence ?? 1000;
                        const seqB = b.source.sequence ?? 1000;
                        return (seqA !== seqB)? seqA - seqB : seqA.index - seqB.index;
                      })
                      .map(item => item.source)

    let sourceAssignmentsList = [];

    for (let source of sources) {
      let sourceAssignments = await source.load(this, mergedContext, {strict});

      sourceAssignmentsList.push(sourceAssignments);
    }
    const config = await this.processAssignments(sourceAssignmentsList, {types: this.types, validators: this.validators, strict});

    if (mergedContext.dumpConfig) {

    }
    return config;
  }

  /**
   * @param {Array[Map<string,any>]} fieldPathAssignmentsList
   * @param {object} [options] - processing options; currently only used for "strict"
   * @param {boolean} [options.strict] - if true, throw an error if any fields are not resolved.
   * @param {TypeRegistry} [options.types]
   * @param {ValidatorRegistry} [options.validators]
   * @returns {Promise<object>}
   */
  async processAssignments(fieldPathAssignmentsList, options) {
    let strict = options?.strict || false;

    const validators = this.validators;
    const configuration = options?.configuration ?? {};

    let allFields = this.schema.getAllFieldPaths();

    /**
     * @type {Map<string, any>}
     */
    let assignments = new Map();

    // We iterate these in reverse to simplify computing the "last (highest priority) definition wins" aspect
    // of exclusive schema categories.  Otherwise, we'd need to bulk-remove multiple assignments associated
    // with the overridden child schema.  (TODO - categories are an obsolete schema concept, is it still necessary to reverse?)

    for (let fieldPathAssignments of fieldPathAssignmentsList.reverse()) {
      for (let [path, value] of Array.from(fieldPathAssignments).reverse()) {
        if (assignments.has(path)) {
          continue;
        }
        assignments.set(path, value)
      }
    }

    // Value resolution phase:
    // Iterate assignments in original definition order (does this actually matter?)
    // Repeat resolution until everything is defined or the set of values is stable.

    const remaining = new Map([...assignments].reverse());

    let done = false;
    let final = false;

    while (!done) {
      let beforeSize = remaining.size;

      for (let [path, value] of remaining) {
        const field = allFields.get(path);

        // Conditions will get re-checked multiple times if they fail, as it is possible they may change
        // value based on updates to configuration state.  Once the configuration has stabilized, we
        // will remove any remaining assignments that failed their condition check.
        //
        // (Note: we don't retroactively reconsider conditional assignments that were previously resolved.
        // This seemed like a reasonable constraint on conditionals in order to avoid the possibility
        // of flapping assignments.  It also seemed unlikely that any real-world scenarios would require
        // that kind of behavior.)

        let condition = field.condition ?? field.schema?.condition;

        if (condition !== undefined) {
          // A negative condition cancels the "required" field check and even blocks default assignments.
          // Interpret it as "this field is deliberately omitted from all processing".

          if (typeof condition === 'function') {
            condition = condition(field, value, configuration);
          }
          if (!condition) {
            if (final) {
              remaining.delete(path);
            }
            continue;
          }
        }

        if (false &&field.inherit) {
          // todo - consider moving "inherit" handling to SchemaDefaultsSource, and making the assignment be a parent value lookup function
          if (strict) {
            throw new ConfiguratorError(`Inherited field ${path} cannot be assigned directly`);
          }
          else {
            continue;
          }
        }

        let resolvedValue = await this.types.resolveTypeValue(field.type, value, configuration);
        if (resolvedValue !== undefined) {
          deepAssign(configuration, path, resolvedValue);
          remaining.delete(path);
        }

        if (final && resolvedValue === undefined && field.required === false) {
          remaining.delete(path);
        }
      }
      if (remaining.size === 0 || remaining.size === beforeSize) {
        if (final) {
          done = true;
        }
        else {
          final = true;  // do one final cleanup pass to remove anything filtered by condition
        }
      }
    }

    if (strict && remaining.size > 0) {
      throw new ConfiguratorError(`Failed to resolve fields: ${Array.from(remaining.keys()).join(', ')}`);
    }
    // we've already typechecked, so we don't need to do that again.
    return await this.validate(configuration, {typecheck: false, strict});
  }

  /**
   * @typedef {Object} ValidationOptions
   * @property {boolean} [strict] - defaults to false
   * @property {boolean} [typecheck] - defaults to true
   * @property {boolean} [populateDefaults] - defaults to false
   */

  /**
   * Validate a configuration object against the schema - (consider renaming to processObject?)
   *
   * @param {object} inputConfig - a configuration object to validate
   * @param {ValidationOptions} options
   * @returns {Promise<object>} - validated configuration object
   */
  async validate(inputConfig, options) {
    const strict = options?.strict || false;
    const typecheck = options?.typecheck ?? true;
    let populateDefaults = options?.populateDefaults ?? false;
    let rootConfig = options?.config ?? inputConfig;
    let prefix = options?.prefix ? `${options.prefix}.` : '';
    let schema = options?.schema ?? this.schema;
    let childName = options?.childName;

    let outputConfig = {};

    let ptr = { parent: options?.ptr ?? null, current: outputConfig };

    for (const [fieldName, schemaField] of schema.fields) {
      let field = {...schemaField, path: `${prefix}${fieldName}`, schema, childName};
      let value = inputConfig[fieldName];

      let condition = field.condition ?? schema.condition;

      if (condition !== undefined) {
        // A negative condition cancels the "required" field check and even blocks default assignments.
        // Interpret it as "this field is deliberately omitted from all processing".

        // TODO: Field value conditions are pretty useless, since complex types will not have the same
        //       value before and after they are resolved.  We should probably deprecate them and only
        //       support schema-level conditions.

        if (typeof condition === 'function') {
          condition = condition(field, value, rootConfig);
        }
        if (!condition) {
          continue;
        }
      }

      // Experimental feature: allow children to inherit values from a parent schema.
      // This is mostly useful if you are initializing application subsystems with
      // only the partial configuration defined by a child schema.  The envisioned use case
      // is to support cross-cutting fields like "--verbose" or "--debug".
      //
      // (Direct assignment to fields marked "inherit" is generally blocked by virtue
      // of fields marked "inherit" being skipped in getAllFieldPaths, but a source
      // that walks the field hierarchy manually would also need to take care to
      // skip inherited fields as there is nothing actually preventing the assignment.

      if (false &&value === undefined && field.inherit) {
        for (let p = ptr.parent; p; p = p.parent) {
          value = p.current[fieldName];
          if (value !== undefined) {
            break;
          }
        }
      }

      // With the normal configurator setup, we have a DefaultsSource that synthesizes assignments
      // for all default values.  This has the benefit of overriding and pruning assignments upstream
      // from here.  In case someone is calling validate on their own object and wants to explicitly fill
      // in missing defaults, they can set the "populateDefaults" option.

      if (value === undefined && field.default !== undefined && populateDefaults) {
        value = field.default;
      }

      // Skip undefined optional fields
      if (value === undefined) {
        if (field.required) {
          throw new ConfiguratorError(`Required field "${fieldName}" is missing`);
        }
        else {
          continue;
        }
      }
      let typeName = field.type;

      if (!typeName) {
        // should have been set upstream!
        throw new ConfiguratorError(`Field "${fieldName}" has no type`);
      }

      if (typeName.startsWith('[') && typeName.endsWith(']')) {
        // note: we will assume that if the inner typeName exists, then the outer array type exists as well.
        // (we check the type using this inner type to simplify the logic, but resolve using the original field.type)
        typeName = typeName.substring(1, typeName.length - 1);
      }

      if (strict && typecheck && !this.types.getType(typeName)) {
        throw new ConfiguratorError(`Unknown type '${field.type}' for field '${fieldName}'`);
      }
      try {
        if (typecheck) {
          value = await this.types.resolveTypeValue(field.type, value, rootConfig);
        }
        if (field.validator !== undefined) {
          value = await this.validators.validate(value, field.validator);  // throws if invalid
        }
      }
      catch (err) {
        throw new ConfiguratorError(`Bad value for field '${fieldName}': ${err.message}`, {cause: err});
      }

      outputConfig[fieldName] = value;
    }

    if (strict) {
      for (const fieldName of Object.keys(inputConfig)) {
        if (!schema.fields.has(fieldName) && !schema.children.has(fieldName)) {
          throw new ConfiguratorError(`Field '${fieldName}' is unknown`);
        }
      }
    }

    // Validate child schemas
    for (const [childName, childSchema] of schema.children) {
      const childInputConfig = inputConfig[childName] || {};

      try {
        const childOutputConfig = await this.validate(childInputConfig, {...options, childName, schema: childSchema, prefix: `${prefix}${childName}`, config: rootConfig, ptr});

        if (Object.keys(childOutputConfig).length > 0) {
          outputConfig[childName] = childOutputConfig;
        }
      }
      catch (error) {
        throw new ConfiguratorError(`Failed to validate "${childName}" (${error.message})`, {cause: error})
      }

    }

    return outputConfig;
  }

}
