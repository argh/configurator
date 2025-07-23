/**
 * Configuration source interface - all sources should implement this
 */
export class ConfigurationSource {
  constructor(name, sequence) {
    this.name = name;  // todo - migrate to using this name to track field assignments by storing an origin tuple of { name, value, "formatted origin info" }
    this.sequence = sequence ?? 1000;
  }

  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - options for parsing
   * @returns {Promise<Object>} Parsed configuration object
   */
  async load(schema, context, options) {

    const fieldPaths = schema.getAllFieldPaths();

    let fieldAssignments = await this._load(schema, context, options);

    const categories = new Map();
    for (let [fieldPath, fieldValue] of fieldAssignments) {
      const field = fieldPaths.get(fieldPath);
      if (!field) {
        throw new Error(`Unknown field reference "${fieldPath}"`);
      }
      if (field.schema.category) {
        if (categories.has(field.schema.category)
            && categories.get(field.schema.category) !== field.schema.id) {
          throw new Error(`${field.path} is incompatible with previous settings in ${field.schema.category} category`);
        }
        categories.set(field.schema.category, field.schema.id);
      }
    }
    return fieldAssignments;
  }

  async _load(schema, context, options) {
    throw new Error(`ConfigurationSource._load() in ${this.name} must be implemented by subclass`);
  }

  static DefaultSequence = Object.freeze({
    SYSTEM_DEFAULTS: 100,
    MODULES: 150,
    SECRETS: 170,
    APP_DEFAULTS: 200,
    ENVIRONMENT: 400,
    ARGUMENTS: 500,
    SERVER: 600,
    CONFIGURATION: 700,
    OVERRIDES: 900
  });



}
