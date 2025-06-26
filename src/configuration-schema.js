import { randomUUID } from 'node:crypto';
import { convertValue, deepAssign, toCamelCase, toKebabCase } from './utils.js';
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

    //name = toCamelCase(name);  // normalize

    if (this.fields.has(name)) {
      throw new Error(`configuration schema field ${name} already defined`);
    }

    if (this.children.has(name)) {
      throw new Error(`configuration schema field ${name} already defined as a child schema`);
    }

    // todo - allow private extended options and don't smoosh everything together into one object
    //        e.g. make moduleName a private contract with its type handler

    let fieldOptions = {
      name,
      type: options.type || 'string',
      default: options.default,
      required: options.required || false,
      description: options.description || '',
      flagHint: options.flagHint,
      validator: options.validator,
      main: options.main || false,                // todo - rename
      advanced: options.advanced || false,
      hidden: options.hidden || false,
      inherit: options.inherit || false
    };
    if (fieldOptions.type === 'module') {
      fieldOptions.moduleName = options.moduleName ?? toKebabCase(name);
      fieldOptions.required = options.required ?? true;  // modules default to required
    }
    if (options.category) {
      fieldOptions.category = options.category;
    }
    this.fields.set(name, fieldOptions);
    return this;
  }

  // todo - formalize this a bit as exclusivity between schema children!
  exclusive(category) {
    this.category = category;
  }

  /**
   * Define a child schema
   * @param {string} name - Child schema name
   * @param {object} options
   */
  child(name, options = {}) {

//    name = toCamelCase(name);  // normalize

    if (this.children.has(name)) {
      throw new Error(`configuration schema child ${name} already defined`);
    }
    if (this.fields.has(name)) {
      throw new Error(`configuration schema child ${name} already defined as a field`);
    }

    const childSchema = options.schema ?? new ConfigurationSchema();
    if (options.category) {
      childSchema.exclusive(options.category);
    }

    this.children.set(name, childSchema);

    return childSchema;
  }


  async processAssignments(fieldPathAssignmentsList, options) {

    let validator = options?.validator;
    let types = options?.types;
    let strict = options?.strict || false;
    const configuration = options?.configuration ?? {};

    let allFields = this.getAllFieldPaths();

    /**
     * @type {Map<string, any>}
     */
    let assignments = new Map();
    const categories = new Map();

    // We iterate these in reverse to simplify computing the "last (highest priority) definition wins" aspect
    // of exclusive schema categories.  Otherwise, we'd need to bulk-remove multiple assignments associated
    // with the overridden child schema.

    for (let fieldPathAssignments of fieldPathAssignmentsList.reverse()) {

      // todo - implied assignments

      for (let [path, value] of Array.from(fieldPathAssignments).reverse()) {
        const field = allFields.get(path);

        if (assignments.has(path)) {
          continue;
        }

        if (field.schema.category) {
          // note - flattened field paths imply that categories are global, not just exclusive between peer children!
          if (categories.has(field.schema.category) && categories.get(field.schema.category) !== field.schema.id) {
            continue;
          }
          categories.set(field.schema.category, field.schema.id);
        }

        assignments.set(path, value)
      }
    }

    // Value resolution phase:
    // Iterate assignments in original definition order (does this actually matter?)
    // Repeat resolution until everything is defined or the set of values is stable.

    const remaining = new Map([...assignments].reverse());

    let done = false;

    while (!done) {

      let beforeSize = remaining.size;

      for (let [path, value] of remaining) {
        const field = allFields.get(path);

//        try {
          let resolvedValue = types?.resolveTypeValue(field.type, value, configuration);
          if (resolvedValue !== undefined) {
            deepAssign(configuration, path, resolvedValue);
            remaining.delete(path);
          }
//        }
//        catch (_) {
          // be careful: exceptions during value resolution are ignored and just result in an undefined value.
          // idea: allow a root injectable field that holds errors?
          // maybe we shouldn't catch at all here?
//        }
      }
      if (remaining.size === 0 || remaining.size === beforeSize) {
        done = true;
      }
    }

    if (strict && remaining.size > 0) {
      throw new Error(`failed to resolve fields: ${Array.from(remaining.keys()).join(', ')}`);
    }

    // note: we deliberately don't pass "types" down, as we've already done type resolution.
    return await this.validate(configuration, {validator, strict, categories});
  }

  // maybe this should be renamed to validate?
  async validate(inputConfig, options) {

    let validator = options?.validator;
    let types = options?.types;

    let strict = options?.strict || false;

    // todo - validate is hard to call correctly, you need to precompute category/schema associations.
    //        without it being pre-populated, it thinks that missing required fields inside pruned children are an error.

    let categories = options?.categories ?? new Map();

    if (this.category) {
      if (categories.has(this.category) && categories.get(this.category) !== this.id) {
        return {};
      }
      categories.set(this.category, this.id);
    }

    let outputConfig = {};

    for (const [fieldName, fieldOptions] of this.fields) {
      let value = inputConfig[fieldName];

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
        if (types) {
          value = types.resolveTypeValue(fieldOptions.type, value, inputConfig);
        }
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

    // Validate child schemas
    for (const [childName, childSchema] of this.children) {
      const childInputConfig = inputConfig[childName] || {};

      try {
        const childOutputConfig = await childSchema.validate(childInputConfig,
          {validator, types, strict, categories});

        if (Object.keys(childOutputConfig).length > 0) {
          outputConfig[childName] = childOutputConfig;
        }
      }
      catch (error) {
        throw new Error(`Failed to validate "${childName}" (${error.message})`, {cause: error})
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
  getAllFieldPaths(query = {}) {
    const paths = new Map();

    function skip(fo = {}) {
      for (let flag of ['hidden', 'advanced', 'system']) {
        if (fo[flag] === true && query[flag] === false) {
          return true;
        }
      }
      return false;
    }

    // Add root fields
    for (const [fieldName, fieldOptions] of this.fields) {
      if (skip(fieldOptions)) {
        continue;
      }
      paths.set(fieldName, { ...fieldOptions, path: fieldName, schema: this });
    }

    for (const [childName, childSchema] of this.children) {
      const childPaths = childSchema.getAllFieldPaths();

      for (const [relativePath, fieldOptions] of childPaths) {
        if (skip(fieldOptions)) {
          continue;
        }
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

