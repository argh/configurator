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
   * @returns {Promise<Object>} Parsed configuration object
   */
  async load(schema, context) {

    const fieldPaths = schema.getAllFieldPaths();

    let fieldValues = await this._load(schema, context);

    const categories = new Map();
    for (let [fieldPath, fieldValue] of fieldValues) {
      const field = fieldPaths.get(fieldPath);
      if (field.schema.category) {
        if (categories.has(field.schema.category)
            && categories.get(field.schema.category) !== field.schema.id) {
          throw new Error(`${field.path} is incompatible with previous settings in ${field.schema.category} category`);
        }
        categories.set(field.schema.category, field.schema.id);
      }
    }
    return fieldValues;
  }

  async _load(schema, context) {
    throw new Error(`ConfigurationSource._load() in ${this.name} must be implemented by subclass`);
  }

  static DefaultSequence = Object.freeze({
    SYSTEM_DEFAULTS: 100,
    APP_DEFAULTS: 200,
    MODULES: 300,
    ENVIRONMENT: 400,
    ARGUMENTS: 500,
    SERVER: 600,
    CONFIGURATION: 700,
    SECRETS: 800,
    OVERRIDES: 900
  });



}
