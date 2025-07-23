import { ConfigurationSource } from './configuration-source.js'

/**
 * Synthesize field assignments for all defaults specified in schema
 * Using a ConfigurationSource for this allows the defaults to be treated like low-priority assignments
 * that can be overridden and pruned (when excluded by an exclusive category).
 */
export class DefaultsSource extends ConfigurationSource
{
  constructor(options = {}) {
    super({...options, name: 'defaults-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.SYSTEM_DEFAULTS});
  }

  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async load(schema, context) {
    const allFields = schema.getAllFieldPaths();

    const fieldAssignments = new Map();
    for (let [fieldName, fieldData] of allFields) {
      if (fieldData.default) {

        fieldAssignments.set(fieldName, fieldData.default);
      }
    }

    return fieldAssignments;

  }
}