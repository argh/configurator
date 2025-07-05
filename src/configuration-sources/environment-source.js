import { deepAssign, toConstantCase } from '../utils.js';

import { ConfigurationSource } from './configuration-source.js'

export class EnvironmentSource extends ConfigurationSource {
  constructor(options) {
    super('environment-source', options?.sequence || ConfigurationSource.DefaultSequence.ENVIRONMENT);

    this.contextFieldName = options?.contextFieldName ?? 'env'

    this.configContextFieldName = options?.configContextFieldName ?? 'config';
  }
  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async _load(schema, context) {

    const appName = context?.appName;

    const appPrefix = toConstantCase(appName? appName : '');

    const allFields = schema.getAllFieldPaths();

    const env = context[this.contextFieldName] ?? process.env;

    if (this.configContextFieldName) {
      const configPath = env[toConstantCase(`${appPrefix}_${this.configContextFieldName}`)];

      if (configPath) {
        context[this.configContextFieldName] = configPath;
      }
    }


    /**
     * @type {Map<string, any>}
     */
    const fieldValues = new Map();

    for (const fieldData of allFields.values()) {
//      todo - figure out how to exclude modules and other complex types
//      if (fieldData.type === 'module') {
//        continue;
//      }

      let envVar;

      const suffix = toConstantCase(fieldData.path);
      if (suffix.indexOf(appPrefix) === 0) {
        envVar = suffix;
      }
      else {
        envVar = (`${appPrefix}_${suffix}`);
      }

      const envVal = env[envVar]

      if (envVal !== undefined) {
        fieldValues.set(fieldData.path, envVal)
      }
    }
    return fieldValues;
  }
}