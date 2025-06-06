import { deepAssign, toConstantCase } from '../utils.js';

import { ConfigurationSource } from './configuration-source.js'

export class EnvironmentSource extends ConfigurationSource {
  constructor(appName, options) {
    super('environment-source', options?.sequence || ConfigurationSource.DefaultSequence.ENVIRONMENT);

    this.appName = appName;
    this.contextFieldName = options?.contextFieldName ?? 'env'
  }
  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async _load(schema, context) {

    const appPrefix = this.appName? `${this.appName}.` : '';

    const allFields = schema.getAllFieldPaths();

    const env = context[this.contextFieldName] ?? process.env;

    /**
     * @type {Map<string, any>}
     */
    const fieldValues = new Map();

    for (const fieldData of allFields.values()) {

      const envVar = toConstantCase(`${appPrefix}${fieldData.path}`);
      const envVal = env[envVar]

      if (envVal !== undefined) {
        fieldValues.set(fieldData.path, envVal)
      }
    }
    return fieldValues;
  }
}