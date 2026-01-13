import { promises as fs } from 'fs';

import { CompiledSchema } from './schema/compiled-schema.js';
import { Schema } from './schema/schema.js';
import {
  ConfigurationSource,
  CommandLineSource,
  EnvironmentSource,
  ObjectSource,
  JsonFileSource
} from './configuration-sources/index.js';
import { ConfiguratorError } from './errors.js';
import { SchemaResolver } from './schema/schema-resolver.js';
import { stringify } from './schema/helpers/stringify.js';
import { existingAssignment } from './schema/helpers/assignments.js';
import { deepAssign } from './utils.js';


const MODULE_INFO = {
  name: 'configurator',
  schema: new Schema().meta('internal')
}

/**
 * @typedef {Object} ConfiguratorOptions
 * @property {Schema} [schema]
 * @property {SchemaResolver} [resolver]
 * @property {Array<ConfigurationSource>} [sources] - if not provided, uses default sources from getDefaultSources()
 * @property {boolean} [helpEnabled] - enable help option
 * @property {boolean} [configEnabled] - enable configuration file option
 * @property {boolean} [dumpEnabled] - enable dump file option
 * @property {boolean} [setPropertyValueEnabled] - enable extended property value setting
 */

/**
 * The Configurator class coordinates configuration.
 *
 * A Schema is provided as input to define a valid configuration.
 *
 * The SchemaResolver is used to compile the input Schema into a CompiledSchema.
 *
 * ConfigurationSource implementations produce configuration assignments that correspond
 * to the CompiledSchema.  These assignments are resolved by priority, and then processed
 * using the CompiledSchema to produce a validated configuration object.
 */
export class Configurator {
  static get Schema() { return Schema };
  static get CompiledSchema() { return CompiledSchema };
  static get SchemaResolver() { return SchemaResolver };

  /**
   * Create a new Configurator
   *
   * If sources are not provided, the default set of sources will be used (see getDefaultSources()).
   * Sources are processed in order of their sequence number (see ConfigurationSource.DefaultSequence).
   *
   * @param {ConfiguratorOptions} [options]
   */
  constructor(options = {}) {
    this._schema = options.schema ?? new Schema('object');
    this._resolver = options.resolver ?? new SchemaResolver();
    this._sources = options.sources;

    const helpEnabled = (options.helpEnabled !== false);
    if (helpEnabled) {
      let helpSchema = Object.values(this._schema._properties).find(schema => schema.metadata['configuratorSchema'] === 'help')
      if (!helpSchema) {
        helpSchema = Configurator.createHelpSchema();
        this._schema.property('help', helpSchema);
      }
    }

    const configEnabled = (options.configEnabled !== false);
    if (configEnabled) {
      let configSchema = Object.values(this._schema._properties).find(schema => schema.metadata['configuratorSchema'] === 'config')
      if (!configSchema) {
        configSchema = Configurator.createConfigSchema();
        this._schema.property('config', configSchema);
      }
      this._configContextName = configSchema._options['context'] ?? 'config';
    }

    const dumpEnabled = (options.dumpEnabled !== false)
    if (dumpEnabled) {
      let dumpSchema = Object.values(this._schema._properties).find(schema => schema.metadata['configuratorSchema'] === 'dump')
      if (!dumpSchema) {
        dumpSchema = Configurator.createDumpSchema();
        this._schema.property('dump', dumpSchema);
      }
      this._dumpContextName = dumpSchema._options['context'] ?? 'dump';
    }

    const setPropertyValueEnabled = (options.setPropertyValueEnabled !== false);
    if (setPropertyValueEnabled) {
      let setPropertyValueEnabledSchema = Object.values(this._schema._properties).find(schema => schema.metadata['configuratorSchema'] === 'setPropertyValue')
      if (!setPropertyValueEnabledSchema) {
        setPropertyValueEnabledSchema = Configurator.createSetPropertyValueSchema()
        this._schema.property('setPropertyValue', setPropertyValueEnabledSchema);
      }
    }

    if (!this._sources) {
      this._sources = Configurator.getDefaultSources({
        configContextName: this._configContextName
      });
    }

  }

  /**
   * Get the default set of configuration sources in priority order.
   *
   * Default sources and their sequence numbers:
   *   300 - ObjectSource(defaults) - application defaults from context.defaults
   *   400 - EnvironmentSource - environment variables
   *   600 - CommandLineSource - command line arguments
   *   900 - JsonFileSource(config) - user configuration file
   *  1000 - ObjectSource(overrides) - highest priority overrides from context.overrides
   *
   * To add custom sources between default sources, create a source with an appropriate
   * sequence number. For example, to add a secrets source between environment (400) and
   * command line (600), use sequence: 500.
   *
   * @example
   * // Simple usage: add a custom source with default priority
   * const configurator = new Configurator({schema});
   * configurator.registerConfigurationSource(new MySecretsSource({sequence: 500}));
   *
   * @example
   * // Advanced usage: full control over source list
   * const sources = Configurator.getDefaultSources();
   * sources.push(new MySecretsSource({sequence: 500}));
   * const configurator = new Configurator({schema, sources});
   *
   * @param {Object} [options]
   * @param {string} [options.configContextName='config'] - context name for configuration file source
   * @returns {Array<ConfigurationSource>}
   */
  static getDefaultSources(options = {}) {
    const configContextName = options.configContextName ?? 'config';

    return [
      new ObjectSource({contextName: 'defaults'}),                                             // 300
      new EnvironmentSource(),                                                                 // 400
      new CommandLineSource(),                                                                 // 600
      new JsonFileSource({contextName: configContextName}),                                    // 900
      new ObjectSource({contextName: 'overrides', sequence: ConfigurationSource.DefaultSequence.OVERRIDES})  // 1000
    ];
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
   * Schema definition being used by this Configurator
   * @returns {Schema}
   */
  get schema() {
    return this._schema;
  }

  /**
   * Resolver being used by this Configurator
   * @returns {SchemaResolver}
   */
  get resolver() {
    return this._resolver;
  }




  /**
   * Main entry point.  Load configuration assignments from all defined sources,
   * and use the highest priority assignments to build a configuration object
   * based on the defined schema.
   *
   * @param {Object} context - configuration context
   * @param {ConfigureOptions} [options] - advanced configuration options
   * @returns {Promise<Object>} - configuration results
   */
  async configure(context, options = {}) {
    const configurationContext = {...context};

    const strict = options?.strict ?? true;
    const deep = options?.deep ?? false;

    const schema = await this._resolver.compile(this._schema);
    const assignments = await this.loadSourceAssignments(schema, configurationContext, strict);

    const configuration = await schema.processAssignments(assignments, undefined,{strict, deep, ...options})

    if (this._dumpContextName && configurationContext[this._dumpContextName]) {
      await this.dump(schema, configuration, configurationContext[this._dumpContextName]);
    }

    return configuration;
  }

  /**
   * Iterate over all sources and build a prioritized map of requested assignments
   *
   * @param {CompiledSchema} schema - the schema each ConfigurationSource should use to understand valid assignments
   * @param {Object} context - configuration context
   * @param {boolean} [strict] - whether to allow accept unexpected configuration inputs
   * @returns {Promise<Map<string, NonNullable<any>>>}
   */
  async loadSourceAssignments(schema, context, strict = true) {

    // sort sources by sequence (processing priority)
    const sources = this.sources
                      .map((source, index) => ({ source, index }))
                      .sort((a, b) => {
                        const seqA = a.source.sequence ?? 1000;
                        const seqB = b.source.sequence ?? 1000;
                        return (seqA !== seqB)? seqA - seqB : seqA.index - seqB.index;
                      })
                      .map(item => item.source)

    const sourceAssignmentsList = [];

    for (const source of sources) {
      let sourceAssignments = await source.load(schema, context, {strict});
      if (!sourceAssignments) {
        sourceAssignments = new Map();  // useful to keep in the list for debugging purposes
      }
      await this._handleContextAssignments(schema, sourceAssignments, context);
      sourceAssignmentsList.push(sourceAssignments);
    }
    // By contract, config file sources need to remove the config property from the context if they handled it
    if (this._configContextName && context[this._configContextName]) {
      throw new ConfiguratorError(`Unable to load configuration from ${context[this._configContextName]}`);
    }

    /**
     * @type {Map<string, NonNullable<any>>}
     */
    const assignments = new Map();

    // We iterate these in reverse to simplify computing "last (highest priority) definition wins".

    for (const propertyPathAssignments of sourceAssignmentsList.reverse()) {
      for (const [path, value] of Array.from(propertyPathAssignments).reverse()) {
        if (existingAssignment(assignments, path)) {
          continue;
        }
        assignments.set(path, value)
      }
    }
    return assignments;
  }

  /**
   * Helper to propagate assignments related to schemas marked with "context" flag into the context
   * @param {CompiledSchema} schema
   * @param {Map<string,NonNullable<any>>} sourceAssignments
   * @param {Object} configurationContext
   * @returns {Promise<void>}
   * @private
   */
  async _handleContextAssignments(schema, sourceAssignments, configurationContext) {
    // Some properties are set up to pass their value downstream to later sources via the context.
    for (const [path, assignedValue] of sourceAssignments) {
      const s = schema.find(path)
      if (s?.options.context) {
        const contextName = (typeof s.options.context === 'string') ? s.options.context : s.name;
        if (contextName) {
          let resolvedValue = assignedValue;
          try {
            resolvedValue = await s._transformValue(assignedValue, configurationContext, contextName, {strict: false});
          }
          catch (_) {
            // ignore, just use original value
          }
          configurationContext[contextName] = resolvedValue;
        }
      }
    }
  }

  /**
   * Factory for building a schema to handle help requests (see CommandLineSource)
   *
   * Configurator uses the "configuratorSchema" metadata to identify properties
   * that need special treatment (in this case: "help")
   *
   * @returns {Schema}
   */
  static createHelpSchema() {

    return new Schema('string')
      .allowEmpty()
      .values(['advanced', 'system'])
      .meta('flagHint', 'h')
      .meta('description', 'display help information')
      .meta('valueDescription', '[advanced]')
      .meta('configuratorSchema', 'help')
      .meta('omitFromSerialize')


//      .property('*', new ConfiguratorSchemaDefinition('string', {
//        values: ['advanced', 'system'],
//        required: false
//      }))
  }

  /**
   * Factory for building a schema to load config files.  The "context" option causes
   * any value assigned to be copied to the context.  If you use the default sources,
   * this setting will get propagated to the sources that handle config files.
   *
   * Configurator uses the "configuratorSchema" metadata to identify properties
   * that need special treatment (in this case: "config")
   *
   * @returns {Schema}
   */

  static createConfigSchema() {
    return new Schema('string')
      .validator({$or: ['-', '$file']})
      .option('context', 'config')
      .meta('flagHint', 'C')
      .meta('description', 'load configuration from file (or - for stdin)')
      .meta('valueDescription', '[path|-]')
      .meta('configuratorSchema', 'config')
      .meta('omitFromSerialize')
  }

  /**
   * Factory for building a schema to handle configuration dump requests.
   *
   * Configurator uses the "configuratorSchema" metadata to identify properties
   * that need special treatment (in this case: "dump")
   *
   * @returns {Schema}
   */
  static createDumpSchema() {
      return new Schema('string')
        .option('context', 'dump')
        .validator('$writable')
        .meta('description', 'dump configuration to file (or - for stdout)')
        .meta('valueDescription', '[path|-]')
        .meta('advanced')
        .meta('configuratorSchema', 'dump')
        .meta('omitFromSerialize');
  }


  /**
   * Factory for building a schema to handle path-based property assignment requests.
   *
   * Configurator uses the "configurationSchema" metadata to identify properties
   * that need special treatment (in this case: "setPropertyValue")
   *
   * @returns {Schema}
   */
  static createSetPropertyValueSchema() {
    return new Schema('array')
      .meta('description', 'set property value using path')
      .meta('advanced')
      .meta('flagHint', 'P')
      .meta('configuratorSchema', 'setPropertyValue')
      .meta('omitFromSerialize')
      .property('0', new Schema('string')
        .meta('description', 'dotted property path')
        .meta('valueDescription', 'path')
        .meta('hidden'))
      .property('1', new Schema('any')
        .meta('description', 'property value')
        .meta('valueDescription', 'value')
        .meta('hidden'));
  }

  /** @import { ConfigureOptions, SerializeOptions } from './schema/types.js' */

  /**
   * Dump formatted configuration to stdout or file
   *
   * TODO - support writing other formats, in particular .env files and .zsh completion scripts.
   * TODO - flag to omit value if it corresponded to the default?
   *
   * @param {CompiledSchema} schema
   * @param {object} config - configuration object to dump
   * @param {string} destination - path to write, or "-" for stdout
   * @param {SerializeOptions} [serializeOptions] -
   * @returns {Promise<void>}
   *
   */
  async dump(schema, config, destination, serializeOptions) {

    const serialized = await schema.serialize(config, {...serializeOptions});

    if (serialized === undefined) {
      throw new ConfiguratorError('Empty configuration');
    }

    const formattedConfig = stringify(serialized, {space: 2});
    if (destination === '-') {
      try {
        console.log(formattedConfig);
        // in the case of stdout, we exit so that no other process output is written.
        process.exit(0);
      }
      catch (error) {
        throw new ConfiguratorError(`Failed to dump configuration to stdout`, {cause: error});
      }
    }
    else if (destination.toLowerCase().endsWith('.json')) {
      try {
        await fs.writeFile(destination, formattedConfig, 'utf8');
      }
      catch (error) {
        throw new ConfiguratorError(`Failed to dump configuration to file ${destination}`, {cause: error});
      }
    }
    else {
      throw new ConfiguratorError(`Unsupported dump output "${destination}" (must be "-" for stdout or end with .json)`);
    }

  }
  toJSON() {
    return "Configurator";
  }
}
