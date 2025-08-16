import { ConfiguratorError } from '../configurator-error.js';

/**
 * Configuration source abstract base class - all sources should implement this
 */
export class ConfigurationSource {
  constructor(nameOrOptions, options) {
    if (typeof nameOrOptions === 'string') {
      this.name = nameOrOptions;
    }
    else {
      this.name = nameOrOptions?.name;
      options = nameOrOptions;
    }
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
    SYSTEM_DEFAULTS: 100,   // schema defaults are loaded at the lowest level
    MODULES:         200,   // for fields referencing lazily-instantiated singletons (see @versionzero/module-manager)
    APP_DEFAULTS:    300,   // takes precedence over schema defaults
    ENVIRONMENT:     400,   // environment variables
    SECRETS:         500,   // can change secrets locations from environment via context if needed
    ARGUMENTS:       600,   // command line arguments
    SERVER:          700,   // online sources, often referenced via arguments, so higher in priority
    INTERACTIVE:     800,   // an interactive session (human in the loop)
    CONFIGURATION:   900,   // configuration files can dynamically change and often specified via arguments, so they are higher in priority
    OVERRIDES:       1000   // if you want to completely block some settings
  });



}
