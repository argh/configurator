import { randomUUID } from 'node:crypto';
import { convertValue, deepAssign, toCamelCase, toKebabCase } from './utils.js';
import { Types } from './types.js';
import { Validators } from './validators.js';
/**
 * Configuration field definition and validation schema
 */
export class ConfigurationSchema {
  /**
   * @typedef {Object} SchemaOptions
   * @property {Types} [types] - override for default field type registry
   * @property {Validators} [validators] - override for default field validator registry
   * @property {Function} [condition] - optional condition to check before processing anything associated with this schema
   */

  /**
   * Create a new configuration schema
   *
   * @param {SchemaOptions} [options]
   */

  constructor(options) {
    this.fields = new Map();
    this.children = new Map();
    this.id = randomUUID();

    this.types = options?.types ?? new Types();
    if (!this.types) {
      throw new Error('ConfigurationSchema requires Types');
    }

    this.validators = options?.validators ?? new Validators()
    if (!this.validators) {
      throw new Error('ConfigurationSchema requires Validators');
    }
    this.condition = options?.condition;
  }

  /** @typedef {Object} FieldOptions
   * @property {string} [type]
   * @property {any} [default]
   * @property {boolean} [allowEmpty]
   * @property {boolean} [required]
   * @property {string} [description]
   * @property {string} [flagHint]
   * @property {Function|string|RegExp|object|undefined} validator
   * @property {boolean} [advanced]
   * @property {boolean} [hidden]
   * @property {boolean} [inherit]
   * @property {Function} [condition]
   */

  /**
   * Define a configuration field
   * @param {string} name - Field name (typically camelCase)
   * @param {FieldOptions} [options] - Field options
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

    let fieldOptions = {...options, name, type: options.type || 'string', required: options.required ?? false, description: options.description ?? ''};

    this.fields.set(name, fieldOptions);
    this._fpCache = null;
    return this;
  }

  /**
   * Define a child schema
   * @param {string} name - Child schema name, typically camelCase
   * @param {SchemaOptions} options - options for the child schema; note that the parent type/validator registries are always used by children
   */
  child(name, options = {}) {

//    name = toCamelCase(name);  // normalize

    if (this.children.has(name)) {
      throw new Error(`configuration schema child ${name} already defined`);
    }
    if (this.fields.has(name)) {
      throw new Error(`configuration schema child ${name} already defined as a field`);
    }

    const childSchema = new ConfigurationSchema({...options, validators: this.validators, types: this.types, condition: options.condition ?? this.condition});

    this.children.set(name, childSchema);
    this._fpCache = null;
    return childSchema;
  }

  /** Make a copy of a schema that allows for field/child extension.  Fields are copied by reference.
   *
   * @returns {ConfigurationSchema}
   */
  copy() {
    let clone = new ConfigurationSchema({types: this.types, validators: this.validators, condition: this.condition});

    for (let [fieldName, fieldOptions] of this.fields) {
      clone.field(fieldName, fieldOptions);
    }

    for (let [childName, childSchema] of this.children) {
      let child = childSchema.copy();
      clone.children.set(childName, child);
    }

    return clone;
  }


  /**
   * @param {Array[Map<string,any>]} fieldPathAssignmentsList
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async processAssignments(fieldPathAssignmentsList, options) {
    let strict = options?.strict || false;

    let types = options?.types ?? this.types;
    const configuration = options?.configuration ?? {};

    let allFields = this.getAllFieldPaths();

    /**
     * @type {Map<string, any>}
     */
    let assignments = new Map();

    // We iterate these in reverse to simplify computing the "last (highest priority) definition wins" aspect
    // of exclusive schema categories.  Otherwise, we'd need to bulk-remove multiple assignments associated
    // with the overridden child schema.  (TODO - categories are an obsolete schema concept, is it still necessary to reverse?)

    for (let fieldPathAssignments of fieldPathAssignmentsList.reverse()) {
      for (let [path, value] of Array.from(fieldPathAssignments).reverse()) {
        if (assignments.has(path)) {
          continue;
        }
        assignments.set(path, value)
      }
    }

    // Value resolution phase:
    // Iterate assignments in original definition order (does this actually matter?)
    // Repeat resolution until everything is defined or the set of values is stable.

    const remaining = new Map([...assignments].reverse());

    let done = false;
    let final = false;

    while (!done) {
      let beforeSize = remaining.size;

      for (let [path, value] of remaining) {
        const field = allFields.get(path);

        // Conditions will get re-checked multiple times if they fail as it is possible they may change
        // value based on updates to configuration state.  Once the configuration has stabilized, we
        // will remove any remaining assignments that failed their condition check.

        let condition = field.condition ?? field.schema.condition;

        if (condition !== undefined) {
          // A negative condition cancels the "required" field check and even blocks default assignments.
          // Interpret it as "this field is deliberately omitted from all processing".

          if (typeof condition === 'function') {
            condition = condition(field, value, configuration);
          }
          if (!condition) {
            if (final) {
              remaining.delete(path);
            }
            continue;
          }
        }

        let resolvedValue = await types.resolveTypeValue(field.type, value, configuration);
        if (resolvedValue !== undefined) {
          deepAssign(configuration, path, resolvedValue);
          remaining.delete(path);
        }

        if (final && resolvedValue === undefined && field.required === false) {
          remaining.delete(path);
        }
      }
      if (remaining.size === 0 || remaining.size === beforeSize) {
        if (final) {
          done = true;
        }
        else {
          final = true;  // do one final cleanup pass to remove anything filtered by condition
        }
      }
    }

    if (strict && remaining.size > 0) {
      throw new Error(`Failed to resolve fields: ${Array.from(remaining.keys()).join(', ')}`);
    }

    // note: we deliberately don't pass "types" down, as we've already done type resolution.
    return await this.validate(configuration, {types: null, strict});
  }

  /**
   * @typedef {Object} ValidationOptions
   * @property {Types} [types]
   * @property {Validators} [validators]
   * @property {boolean} [strict]
   * @property {boolean} [populateDefaults]
   */

  /**
   * Validate a configuration object against the schema - (consider renaming to processObject?)
   *
   * @param {object} inputConfig - a configuration object to validate
   * @param {ValidationOptions} options
   * @returns {Promise<object>} - validated configuration object
   */
  async validate(inputConfig, options) {
    let strict = options?.strict || false;
    let types = options?.types ?? this.types;
    let validators = options?.validators ?? this.validators;
    let populateDefaults = options?.populateDefaults ?? false;
    let rootConfig = options?.config ?? inputConfig;

    let prefix = options?.prefix ? `${options.prefix}.` : '';

    let outputConfig = {};

    for (const [fieldName, schemaField] of this.fields) {
      let field = {...schemaField, path: `${prefix}${fieldName}`};
      let value = inputConfig[fieldName];

      let condition = field.condition ?? this.condition;

      if (condition !== undefined) {
        // A negative condition cancels the "required" field check and even blocks default assignments.
        // Interpret it as "this field is deliberately omitted from all processing".

        if (typeof condition === 'function') {
          condition = condition(field, value, rootConfig);
        }
        if (!condition) {
          continue;
        }
      }

      // With the normal configurator setup, we have a DefaultsSource that synthesizes assignments
      // for all default values.  This has the benefit of overriding and pruning assignments upstream
      // from here.  In case someone is calling validate on their own object and wants to explicitly fill
      // in missing defaults, they can set the "populateDefaults" option.

      if (value === undefined && field.default !== undefined && populateDefaults) {
        value = field.default;
      }

      // Skip undefined optional fields
      if (value === undefined) {
        if (field.required) {
          throw new Error(`Required field "${fieldName}" is missing`);
        }
        else {
          continue;
        }
      }
      if (strict && types && !types.getType(field.type)) {
        throw new Error(`Unknown type '${field.type}' for field '${fieldName}'`);
      }
      try {
        if (types) {
          value = await types.resolveTypeValue(field.type, value, rootConfig);
        }
        if (validators && field.validator !== undefined) {
          value = await validators.validate(value, field.validator);  // throws if invalid
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
        const childOutputConfig = await childSchema.validate(childInputConfig, {...options, prefix: `${prefix}${childName}`, config: rootConfig});

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

  getTaggedField(tag) {
    for (const [fieldName, fieldOptions] of this.getAllFieldPaths()) {
      if (fieldOptions[tag]) {
        return fieldOptions;
      }
    }
    return undefined;
  }

  /**
   * Return true if any field is marked as "advanced"
   * @returns {boolean}
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


  /** @typedef {FieldOptions} ExtendedFieldOptions
   * @property {string} path
   */

  /** @type {Map<string, ExtendedFieldOptions>} */
  _fpCache = null;

  /**
   * Return map of entire schema hierarchy keyed by dotted field paths
   *
   * @param query
   * @returns {Map<string, ExtendedFieldOptions>}
   */
  getAllFieldPaths(query = {}) {
    if (this._fpCache) {
      return this._fpCache;
    }
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
    this._fpCache = paths;
    return paths;

  }
}

