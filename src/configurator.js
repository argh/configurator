import { ConfigurationSchema } from './configuration-schema.js';
import { Validator } from './validator.js';
import { deepAssign, deepMerge, toConstantCase } from './utils.js';
import { CommandLineSource } from './configuration-sources/command-line-source.js';
import { EnvironmentSource } from './configuration-sources/environment-source.js';
import { ObjectSource } from './configuration-sources/object-source.js';

const MODULE_INFO = {
  name: 'configurator'
}

export class Configurator {

  /**
   * @typedef {Object} ConfiguratorOptions
   * @property {ConfigurationSchema?} schema
   * @property {Validator?} validator
   * @property {Array<ConfigurationSource>?} sources
   * @property {string} configField
   * @property {string} configFlag
   */

  /**
   * @param {string} appName
   * @param {ConfiguratorOptions?} options
   */
  constructor(appName, options) {
    this.APP_NAME = toConstantCase(appName);

    this._schema = options?.schema ?? new ConfigurationSchema();
    this._validator = options?.validator ?? new Validator();

    this.sources = options?.sources;
    if (!this.sources) {
      this.sources = [];

      this.sources.push(new ObjectSource({contextName: 'sys'}));
      this.sources.push(new EnvironmentSource(appName));
      this.sources.push(new CommandLineSource());

      this.schema.field(options?.configField ?? 'config', {
        flagHint: options?.configFlag ?? 'C', validator: '$filename'
      })
    }
  }

  registerConfigurationSource(source) {
    this.sources.push(source);
  }

  static get moduleInfo() { return MODULE_INFO }

  get schema() {
    return this._schema;
  }

  get validator() {
    return this._validator;
  }

  async configure(context, strict = false) {
    let sources = this.sources
                      .map((source, index) => ({ source, index }))
                      .sort((a, b) => {
                        const seqA = a.source.sequence ?? 1000;
                        const seqB = b.source.sequence ?? 1000;
                        return (seqA !== seqB)? seqA - seqB : seqA.index - seqB.index;
                      })
                      .map(item => item.source)

    let allFields = this.schema.getAllFieldPaths();
    /**
     * @type {Map<string, any>}
     */
    let assignments = new Map();

    function clearConflicts(category) {
      for (const [path, value] of assignments) {
        if (allFields.has(path)) {
          const field = allFields.get(path);
          if (field.schema.category === category) {
            assignments.delete(path);
          }
        }
      }
    }

    const categories = new Map();
    for (let source of sources) {

      let sourceContext = {...context}

      let sourceAssignments = await source.load(this.schema, sourceContext);

      for (let [path, value] of sourceAssignments) {
        const field = allFields.get(path);

        // override/clear all previous assignments within a category

        if (field.schema.category) {
          if (categories.has(field.schema.category) && categories.get(field.schema.category) !== field.schema.id) {
            clearConflicts(field.schema.category);
          }
          categories.set(field.schema.category, field.schema.id);
        }
        assignments.set(path, value);
      }
    }

    const configuration = {};
    for (let [path, value] of assignments) {
      deepAssign(configuration, path, value);
    }
    return await this.schema.process(configuration, {validator: this.validator, strict});
  }

  async init() {
    await this.configure();
  }
}
