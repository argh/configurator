import { ConfiguratorError } from '../configurator-error.js';

/**
 * Configuration source abstract base class - all sources should implement this
 */
export class ConfigurationSource {
  constructor(nameOrOptions, options) {
    if (typeof nameOrOptions === 'string') {
      options = options ?? {};
      options.name = nameOrOptions;
    }
    this.name = nameOrOptions ?? options.name;  // todo - migrate to using this name to track field assignments by storing an origin tuple of { name, value, "formatted origin info" }
    this.sequence = options?.sequence ?? 1000;
  }

  /**
   * Parse configuration from this source
   * @param {Configurator} configurator - Configurator
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - options for parsing
   * @returns {Promise<Object>} Parsed configuration object
   */
  async load(configurator, context, options) {

    const fieldPaths = configurator.schema.getAllFieldPaths();

    let fieldAssignments = await this._load(configurator, context, options);

    const categories = new Map();
    for (let [fieldPath, fieldValue] of fieldAssignments) {
      const field = fieldPaths.get(fieldPath);
      if (!field) {
        throw new ConfiguratorError(`Unknown field reference "${fieldPath}"`);
      }
      if (field.schema.category) {
        if (categories.has(field.schema.category)
            && categories.get(field.schema.category) !== field.schema.id) {
          throw new ConfiguratorError(`${field.path} is incompatible with previous settings in ${field.schema.category} category`);
        }
        categories.set(field.schema.category, field.schema.id);
      }
    }
    return fieldAssignments;
  }

  async _load(configurator, context, options) {
    throw new Error(`ConfigurationSource._load() in ${this.name} must be implemented by subclass`);
  }

  static DefaultSequence = Object.freeze({
    SYSTEM_DEFAULTS: 100,
    MODULES:         200,
    SECRETS:         300,
    APP_DEFAULTS:    400,
    ENVIRONMENT:     500,
    ARGUMENTS:       600,
    SERVER:          700,
    CONFIGURATION:   800,
    OVERRIDES:       900
  });



}
