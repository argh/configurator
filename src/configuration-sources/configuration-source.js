
export class FieldPathValueMap extends Map {

  categories = new Set();

  constructor() {
    super();


  }

  get(key) {
    return super.get(key);
  }

  /**
   * @typedef {object} FieldPathValue
   * @property {any} value
   * @property {FieldOptions} field
   */

  /**
   *
   * @param path
   * @param {FieldPathValue} fv
   */
  set(path, fv) {

    if (fv.field.schema.category) {
      if (this.categories.has(fv.field.schema.category) && this.categories.get(fv.field.schema.category) !== fv.field.schema.id) {
        throw new Error(`${fv.longOption} is incompatible with other settings in ${fv.field.schema.category} category`);
      }
      this.categories.set(fv.field.schema.category, fv.field.schema.id);
    }

    super.set(path, fv);
  }

}

const fieldPathValues = new Map();
const categories = new Set();
function setFieldPathValue(field, value) {
  if (field.schema.category) {
    if (categories.has(field.schema.category)) {
      if (categories.get(field.schema.category) !== field.schema.id) {

      }
      categories.set(field.schema.category, field.schema.id);
    }
  }
  fieldPathValues.set(field.path, {source: this.name, field, value});
}

/**
 * Configuration source interface - all sources should implement this
 */
export class ConfigurationSource {
  constructor(name, sequence) {
    this.name = name;
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
    throw new Error('ConfigurationSource._load() must be implemented by subclass');
  }

  static DefaultSequence = Object.freeze({
    BASE: 100,
    ENVIRONMENT: 200,
    ARGUMENTS: 300,
    SERVER: 400,
    CONFIGURATION: 500,
    SECRETS: 600
  });



}
