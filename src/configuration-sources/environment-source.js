import { deepAssign, toConstantCase } from '../utils.js';

import { ConfigurationSource } from './configuration-source.js'

export class EnvironmentSource extends ConfigurationSource {
  constructor(options = {}) {
    super({...options, name: 'environment-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.ENVIRONMENT});

    this.contextFieldName = options?.contextFieldName ?? 'env'
  }
  /**
   * Parse configuration from this source
   * @param {Configurator} configurator
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async _load(configurator, context) {

    const appName = context?.appName;

    const appPrefix = toConstantCase(appName? appName : '');

    const allFields = configurator.schema.getAllFieldPaths();

    const env = context[this.contextFieldName] ?? process.env;

    /**
     * @type {Map<string, any>}
     */
    const fieldAssignments = new Map();

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

      let envVal = env[envVar]

      if (fieldData.type === 'array' || (fieldData.type.startsWith('[') && fieldData.type.endsWith(']'))) {
        if (envVal) {
          envVal = envVal.split(',').map(v => v.trim());
        }
      }

      if (envVal !== undefined) {
        fieldAssignments.set(fieldData.path, envVal)
      }
      // we sometimes want to pass a configured value to other configuration sources downstream:
      if (fieldData.context) {
        if (typeof fieldData.context === 'string') {
          context[fieldData.context] = envVal;
        }
        else {
          context[fieldData.name] = envVal;
        }
      }
    }
    return fieldAssignments;
  }
}