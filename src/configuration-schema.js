import { randomUUID } from 'node:crypto';
import { convertValue, toCamelCase } from './utils.js';
/**
 * Configuration field definition and validation schema
 */
export class ConfigurationSchema {
  constructor() {
    this.fields = new Map();
    this.children = new Map();
    this.id = randomUUID()
  }

  /** @typedef {Object} FieldOptions
   * @property {string?} type
   * @property {any?} default
   * @property {boolean?} required
   * @property {string?} description
   * @property {string?} flagHint
   * @property {Function|string|RegExp|object|undefined} validator
   * @property {boolean?} advanced
   * @property {boolean?} hidden
   * @property {boolean?} inherit
   */

  /**
   * Define a configuration field
   * @param {string} name - Field name (typically camelCase)
   * @param {FieldOptions?} options - Field options
   */
  field(name, options = {}) {

    name = toCamelCase(name);  // normalize

    this.fields.set(name, {
      name,
      type: options.type || 'string',
      default: options.default,
      required: options.required || false,
      description: options.description || '',
      flagHint: options.flagHint,
      validator: options.validator,
      main: options.main || false,
      advanced: options.advanced || false,
      hidden: options.hidden || false,
      inherit: options.inherit || false
    });
    return this;
  }

  exclusive(category) {
    this.category = category;
  }

  /**
   * Define a child schema
   * @param {string} name - Child schema name
   * @param {object} options
   */
  child(name, options = {}) {

    name = toCamelCase(name);  // normalize

    const childSchema = options.schema ?? new ConfigurationSchema();
    if (options.category) {
      childSchema.exclusive(options.category);
    }

    this.children.set(name, childSchema);

    return childSchema;
  }


  async process(inputConfig, options) {

    let parentConfig = options?.parentConfig;
    let validator = options?.validator;
    let strict = options?.strict || false;

    let outputConfig = {}; // todo - new ConfigurationProxy(); ?
    for (const [fieldName, fieldOptions] of this.fields) {
      let value = inputConfig[fieldName];

      if (value === undefined) {
        if (fieldOptions.inherit && parentConfig !== undefined) {
          value = parentConfig[fieldName];  // note if refactored: this relies on populated parent
        }
        else if (fieldOptions.default !== undefined) {
          value = fieldOptions.default;
        }
      }

      // Skip undefined optional fields
      if (value === undefined) {
        if (fieldOptions.required) {
          throw new Error(`Required field '${fieldName}' is missing`);
        }
        else {
          continue;
        }
      }
      try {
        // Type conversion and validation
        value = convertValue(value, fieldOptions.type, fieldName);

        if (validator) {
          value = await validator.validate(value, fieldOptions.validator);  // throws if invalid
        }
      }
      catch (err) {
        throw new Error(`Bad value for field '${fieldName}': ${err.message}`, {cause: err});
      }

      outputConfig[fieldName] = value;
    }

    if (strict) {
      for (const fieldName of Object.keys(inputConfig)) {
        if (!this.fields.has(fieldName) && !this.children.has(fieldName)) {
          throw new Error(`Field '${fieldName}' is unknown`);
        }
      }
    }

    let categories = new Set();
    // Validate child schemas
    for (const [childName, childSchema] of this.children) {
      const childInputConfig = inputConfig[childName] || {};

      const childOutputConfig = await childSchema.process(childInputConfig, {validator, parentConfig: outputConfig, strict});

      if (Object.keys(childOutputConfig).length > 0) {
        outputConfig[childName] = childOutputConfig;
      }
    }

    return outputConfig;
  }


  /**
   * Get all field definitions
   */
  getFields() {
    return new Map(this.fields);
  }

  /**
   * Get child schema definitions
   */
  getChildren() {
    return new Map(this.children);
  }

  /**
   * Get the main field (field with main: true)
   */
  getMainField() {
    for (const [fieldName, fieldOptions] of this.fields) {
      if (fieldOptions.main) {
        return { name: fieldName, options: fieldOptions };
      }
    }
    return null;
  }

  /**
   * Check if schema has any advanced fields
   */
  hasAdvancedFields() {
    for (const [, fieldOptions] of this.fields) {
      if (fieldOptions.advanced && !fieldOptions.hidden) return true;
    }
    for (const [, childSchema] of this.children) {
      if (childSchema.hasAdvancedFields()) return true;
    }
    return false;
  }

  /**
   * Get all field paths including nested ones
   */
  getAllFieldPaths() {
    const paths = new Map();

    // Add root fields
    for (const [fieldName, fieldOptions] of this.fields) {
      paths.set(fieldName, { ...fieldOptions, path: fieldName, schema: this });
    }

    for (const [childName, childSchema] of this.children) {
      const childPaths = childSchema.getAllFieldPaths();

      for (const [relativePath, fieldOptions] of childPaths) {
        const fullPath = `${childName}.${relativePath}`;

        paths.set(fullPath, {
          ...fieldOptions,
          path: fullPath
        })
      }
    }

    return paths;

  }
}

