import { promises as fs } from 'fs';

import { CompiledSchema } from './schema/compiled-schema.js';
import { Schema } from './schema/schema.js';
import {
  ConfigurationSource,
  CommandLineSource,
  SchemaDefaultsSource,
  EnvironmentSource,
  ObjectSource,
  JsonFileSource
} from './configuration-sources/index.js';
import { ConfiguratorError } from './errors.js';
import { SchemaResolver } from './schema/schema-resolver.js';

const MODULE_INFO = {
  name: 'configurator'
}

/**
 * The Configurator class coordinates configuration using a schema, configuration sources,
 * a type registry, and a validator registry.
 */
export class Configurator {
  static get Schema() { return Schema };
  static get CompiledSchema() { return CompiledSchema };
  static get SchemaResolver() { return SchemaResolver };
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
   *   100 - SchemaDefaultsSource - schema-defined defaults
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
      new SchemaDefaultsSource(),                                                              // 100
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
   * Main entry point.  Pull configuration assignments from all defined sources,
   * and use the highest priority assignments to build a configuration object
   * based on the defined schema.
   *
   * @param {Object} context
   * @param {boolean} strict
   * @returns {Promise<Object>}
   */
  async configure(context, strict = true) {

    const schema = this._resolver.compile(this._schema);

    const configurationContext = {...context};

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
      let sourceAssignments = await source.load(schema, configurationContext, {strict});
      if (!sourceAssignments) {
        sourceAssignments = new Map();  // useful to keep in the list for debugging purposes
      }

      // Some properties are set up to pass their value downstream to later sources via the context.
      for (let [path, assignedValue] of sourceAssignments) {
        const s = schema.find(path)
        if (s?.options.context) {
          const contextName = (typeof s.options.context === 'string') ? s.options.context : s.name;
          if (contextName) {
            let resolvedValue = assignedValue;
            try {
              resolvedValue = await s.transform(assignedValue, configurationContext, contextName, {strict: false});
            }
            catch (_) {
              // ignore, just use original value
            }
            configurationContext[contextName] = resolvedValue;
          }
        }
      }
      sourceAssignmentsList.push(sourceAssignments);
    }
    // By contract, config file sources need to remove the config property from the context if they handled it
    if (this._configContextName && configurationContext[this._configContextName]) {
      throw new ConfiguratorError(`Unable to load configuration from ${configurationContext[this._configContextName]}`);
    }

    /**
     * @type {Map<string, NonNullable<any>>}
     */
    let assignments = new Map();

    // We iterate these in reverse to simplify computing "last (highest priority) definition wins".

    for (let propertyPathAssignments of sourceAssignmentsList.reverse()) {
      for (let [path, value] of Array.from(propertyPathAssignments).reverse()) {
        if (assignments.has(path)) {
          continue;
        }
        assignments.set(path, value)
      }
    }

    const transformed = await schema.processAssignments(assignments, {},{strict})

    if (this._dumpContextName && configurationContext[this._dumpContextName]) {
      await this.dump(schema, transformed, configurationContext[this._dumpContextName]);
    }
    return transformed;
  }

  /**
   * Factory for building a schema to handle help requests (see CommandLineSource)
   *
   * Configurator uses the "configuratorSchema" metadata to identify properties
   * that need special treatment (in this case: "help")
   *
   * @param {Object} [attributes]             - override default attributes
   * @returns {Schema}
   */
  static createHelpSchema(attributes) {
    return new Schema('string', Object.assign({
      allowEmpty: true,
      values: ['advanced', 'system'],
      _flagHint: 'h',
      _description: 'display help information',
      _valueDescription: '[advanced]',
      _configuratorSchema: 'help',
      _omitFromSerialize: true
    }, attributes))
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
   * @param {Object} [attributes]             - override default attributes
   * @returns {Schema}
   */

  static createConfigSchema(attributes) {
    return new Schema('string', Object.assign({
      validator: {$or: ['-', '$file']},
      context: 'config',
      _flagHint: 'C',
      _description: 'load configuration from file (or - for stdin)',
      _valueDescription: '[path|-]',
      _configuratorSchema: 'config',
      _omitFromSerialize: true
    }, attributes))
  }

  /**
   * Factory for building a schema to handle configuration dump requests.
   *
   * Configurator uses the "configuratorSchema" metadata to identify properties
   * that need special treatment (in this case: "dump")
   *
   * @param {Object} [attributes]             - override default attributes
   * @returns {Schema}
   */
  static createDumpSchema(attributes) {
      return new Schema('string', Object.assign({
        context: 'dump',
        validator: '$writable',
        _description: 'dump configuration to file (or - for stdout)',
        _valueDescription: '[path|-]',
        _advanced: true,
        _configuratorSchema: 'dump',
        _omitFromSerialize: true
      }, attributes));
  }


  static createSetPropertyValueSchema(attributes) {
    return new Schema('array', Object.assign({
      _description: 'set property value using path',
      _advanced: true,
      _flagHint: 'P',
      _configuratorSchema: 'setPropertyValue',
      _omitFromSerialize: true
    }, attributes))
      .property('0', new Schema('string', {
        _description: 'dotted property path',
        _valueDescription: 'path',
        _hidden: true
      }))
      .property('1', new Schema('any', {
        _description: 'property value',
        _valueDescription: 'value',
        _hidden: true
      }))
  }

  /**
   * Dump formatted configuration to stdout or file
   *
   * TODO - support writing other formats, in particular .env files and .zsh completion scripts.
   * TODO - flag to omit value if it corresponded to the default?
   *
   * @param {CompiledSchema} schema
   * @param {object} config - configuration object to dump
   * @param {string} destination - path to write, or "-" for stdout
   * @param {boolean} all - if true, include all settable properties
   * @returns {Promise<void>}
   *
   */
  async dump(schema, config, destination, all = false) {

    const serialized = await schema.serialize(config, {all});
    const formattedConfig = JSON.stringify(serialized, null, 2);
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
