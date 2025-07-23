import { ConfigurationSchema } from './configuration-schema.js';
import { CommandLineSource } from './configuration-sources/command-line-source.js';
import { EnvironmentSource } from './configuration-sources/environment-source.js';
import { ObjectSource } from './configuration-sources/object-source.js';
import { ConfigurationSource } from './configuration-sources/configuration-source.js';
import { DefaultsSource } from './configuration-sources/defaults-source.js';
import { JsonFileSource } from './configuration-sources/json-file-source.js';

const MODULE_INFO = {
  name: 'configurator'
}

export class Configurator {

  /**
   * @typedef {Object} ConfiguratorOptions
   * @property {ConfigurationSchema} [schema]
   * @property {Validators} [validator]
   * @property {Array<ConfigurationSource>} [sources]
   * @property {boolean} [configEnabled]
   * @property {string} [configField]
   * @property {string} [configFlag]
   * @property {string} [configContextFieldName]
   * @property {object} [defaults] - optional ObjectSource configuration source data to use as defaults
   */

  /**
   * @param {ConfiguratorOptions?} options
   */
  constructor(options = {}) {
    this._schema = options.schema ?? new ConfigurationSchema();
    this._sources = options.sources;

    let configField = options.configField ?? 'config';
    let configFlag = options.configFlag ?? 'C';
    let configDescription = options.configDescription ?? 'load configuration from file';
    let configValueDescription = options.configValueDescription ?? 'path';

    let configContextFieldName = options.configContextFieldName ?? 'config';

    if (options.configEnabled) {
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
      this.registerConfigurationSource(new DefaultsSource());                                     // system/schema defaults
      this.registerConfigurationSource(new ObjectSource({contextFieldName: 'defaults'}));  // app defaults
      this.registerConfigurationSource(new EnvironmentSource());
      let commandLineSourceOptions = {};
      if (options.configEnabled) {

      }
      this.registerConfigurationSource(new CommandLineSource(commandLineSourceOptions));
      /*
      this.registerConfigurationSource(new CommandLineSource({
          configEnabled: options.configEnabled ?? true,
          configField: options.configField ?? 'config',
          configFlag: options.configFlag ?? 'C',
          configContextFieldName: options.configContextFieldName ?? 'config'
        })
      );
       */
      this.registerConfigurationSource(new JsonFileSource({
        contextFieldName: options.configField ?? 'config'
      }))
      this.registerConfigurationSource(new ObjectSource({contextFieldName: 'overrides', sequence: ConfigurationSource.DefaultSequence.OVERRIDES}));
    }

    this.context = {};

    if (options.defaults) {
      this.context['defaults'] = options.defaults; // app defaults; todo - rename to avoid confusion?
    }

  }

  registerConfigurationSource(source) {
    if (! source instanceof ConfigurationSource) {
      throw new Error('Configurator configuration source must be an instance of ConfigurationSource');
    }
    this._sources.push(source);
  }
  get sources() {
    return this._sources;
  }

  static get moduleInfo() { return MODULE_INFO }

  /** @type {ConfigurationSchema} */
  get schema() {
    return this._schema;
  }

  /** @type {Validators} */
  get validator() {
    return this.schema.validators;
  }

  /** @type {Types} */
  get types() {
    return this.schema.types;
  }

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
      let sourceAssignments = await source.load(this.schema, mergedContext, {strict});

      sourceAssignmentsList.push(sourceAssignments);
    }
    return await this.schema.processAssignments(sourceAssignmentsList, {strict})
  }

}
