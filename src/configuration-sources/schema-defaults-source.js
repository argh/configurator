import { ConfigurationSource } from './configuration-source.js'
import { ConfiguratorError } from '../configurator-error.js';

/**
 * Synthesize field assignments for all defaults specified in schema
 * Using a ConfigurationSource for this allows the defaults to be treated like low-priority assignments
 * that can be overridden and pruned (when excluded by an exclusive category).
 */
export class SchemaDefaultsSource
  extends ConfigurationSource
{
  constructor(options = {}) {
    super({...options, name: 'defaults-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.SYSTEM_DEFAULTS});
  }

  /**
   * Parse configuration from this source
   * @param {Configurator} configurator
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - options for parsing (not used by this source)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async load(configurator, context, options) {
    const allFields = configurator.schema.getAllFieldPaths({inherit:true});

    const fieldAssignments = new Map();
    for (let [fieldName, fieldData] of allFields) {
      if (fieldData.default) {

        fieldAssignments.set(fieldName, fieldData.default);
      }

      if (fieldData.inherit) {

        let parentFieldName = fieldName.substring(0, fieldName.lastIndexOf('.'));

        if (parentFieldName === '') {
          throw new ConfiguratorError(`Root field "${fieldName}" cannot be marked "inherit"`);
        }
        fieldAssignments.set(fieldName, (config) => {

          let prefix = parentFieldName;
          while (true) {

            prefix = prefix.substring(0, prefix.lastIndexOf('.'));

            let path = (prefix === '')? fieldData.name : `${prefix}.${fieldData.name}`;

            try {
              let value = path.split('.').reduce((curr, key) => curr?.[key], config);

              if (value !== undefined) {
                return value;
              }
            }
            catch (err) {
              console.error('woops')
            }

            if (prefix === '') {
              return undefined;
            }
          }


        })



      }
      // todo - perhaps generate dynamic assignment values for fields marked "inherit"?
    }

    return fieldAssignments;

  }
}