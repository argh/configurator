import { ConfiguratorError } from '../errors.js';
import {CompiledSchema} from '../schema/compiled-schema.js'

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
   * @param {CompiledSchema} schema -
   * @param {Object} context - collection of source-specific fields (argv, env, etc.)
   * @param {Object} [options] - options for parsing
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async load(schema, context, options) {
    throw new Error(`ConfigurationSource.load() in ${this.name} must be implemented by subclass`);
  }

  /**
   * Standard sequence numbers for configuration sources.
   * Lower numbers are processed first (lower priority), higher numbers are processed last (higher priority).
   * When multiple sources assign the same property, the highest sequence number wins.
   *
   * Use these constants when creating custom sources to ensure proper priority ordering:
   * @example
   * new MySecretsSource({ sequence: ConfigurationSource.DefaultSequence.SECRETS })
   *
   * To insert between standard slots, use intermediate values:
   * @example
   * new MyCustomSource({ sequence: 450 }) // Between ENVIRONMENT(400) and SECRETS(500)
   */
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
    OVERRIDES:       1000   // if you want to completely block or replace some settings
  });



}
