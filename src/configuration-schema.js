import { randomUUID } from 'node:crypto';
import { deepAssign, toKebabCase } from './utils.js';
import { ConfiguratorError } from './configurator-error.js';

export class ConfigurationSchemaError extends ConfiguratorError {}


/** @typedef {Object} FieldOptions
 * @property {string} [type] - resolver name in the Types registry; defaults to "string".
 * @property {Function|string|RegExp|object|undefined} validator - validator specification; see Validators.
 * @property {Function} [condition] - per-field conditional; overrides schema condition
 * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
 * @property {boolean} [inherit] - disallow direct assignment; value will be inherited from a parent
 * @property {boolean} [required] - flag indicating whether this field is required
 * @property {any} [default] - default value; used by SchemaDefaultsSource.
 * @property {string} [description] - help text description; used by CommandLineSource
 * @property {string} [flagHint] - request a specific flag character; used by CommandLineSource
 * @property {boolean} [advanced] - filter from basic help text; used by CommandLineSource
 * @property {boolean} [hidden] - hide from help; used by CommandLineSource
 * @property {...*} [otherProperties] - custom attributes that may be interpreted by configuration sources
 */

/**
 * Configuration field definition and validation schema
 */
export class ConfigurationSchema {
  /**
   * @typedef {Object} SchemaOptions
   * @property {Function} [condition] - optional conditional to check before processing anything associated with this schema
   * @property {string} [linkedParentFieldName] - optional field defined in the parent schema that must be set
   * @property {string} [linkedParentFieldValue] - optional value that must match in the field
   */

  /**
   * Create a new configuration schema
   *
   * @param {SchemaOptions} [options]
   */
  constructor(options) {
    /** @type {string} */
    this.id = randomUUID();

    /** @type {Map<string,FieldOptions>} */
    this.fields = new Map();

    /** @type {Map<string,ConfigurationSchema>} */
    this.children = new Map();

    /** @type {Function|boolean|undefined} */
    this.condition = options?.condition;

    /** @type {ConfigurationSchema} */
    this.parent = null;

    /** @type {string} */
    this.linkedParentFieldName = options?.linkedParentFieldName;
    if (this.linkedParentFieldName) {
      this.linkedParentFieldValue = options?.linkedParentFieldValue;
    }
  }

  /** @typedef {Object} FieldOptions
   * @property {string} [type] - resolver name in the Types registry; defaults to "string".
   * @property {Function|string|RegExp|object|undefined} validator - validator specification; see Validators.
   * @property {Function} [condition] - per-field conditional; overrides schema condition
   * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
   * @property {boolean} [inherit] - disallow direct assignment; value will be inherited from a parent
   * @property {boolean} [required] - flag indicating whether this field is required
   * @property {any} [default] - default value; used by SchemaDefaultsSource.
   * @property {string} [description] - help text description; used by CommandLineSource
   * @property {string} [flagHint] - request a specific flag character; used by CommandLineSource
   * @property {boolean} [advanced] - filter from basic help text; used by CommandLineSource
   * @property {boolean} [hidden] - hide from help; used by CommandLineSource
   * @property {...*} [otherProperties] - custom attributes that may be interpreted by configuration sources
   */

  /**
   * Define a configuration field
   * @param {string} name - Field name (typically camelCase)
   * @param {FieldOptions} [options] - Field options
   * @returns {ConfigurationSchema} - this schema, for chaining
   */
  field(name, options = {}) {
    if (!name && options.name) {
      name = options.name;
    }
    if (!name) {
      throw new ConfigurationSchemaError('configuration schema field name must be specified');
    }
    //name = toCamelCase(name);  // normalize

    if (this.fields.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema field ${name} already defined`);
    }

    if (this.children.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema field ${name} already defined as a child schema`);
    }

    // todo - allow private extended options and don't smoosh everything together into one object

    let fieldOptions = {...options, name, type: normalizeTypeName(options.type), required: options.required ?? false, description: options.description ?? '', schema: this };
    Object.defineProperty(fieldOptions, 'path', {
      get: () => {
        return this.path? `${this.path}.${name}` : name;
      },
      enumerable: true
    })
    this.fields.set(name, fieldOptions);
    this._fpCache = null;
    return this;
  }

  /**
   * Define a child schema
   * @param {string} name - Child schema name, typically camelCase
   * @param {SchemaOptions|ConfigurationSchema} schemaOrOptions - child to use, or options for a new child schema
   */
  child(name, schemaOrOptions = {}) {

//    name = toCamelCase(name);  // normalize

    if (this.children.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema child ${name} already defined`);
    }
    if (this.fields.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema child ${name} already defined as a field`);
    }

    let childOptions = (schemaOrOptions instanceof ConfigurationSchema)? {} : schemaOrOptions;

    let childSchema = (schemaOrOptions instanceof ConfigurationSchema)
                      ? schemaOrOptions.copy()
                      : new ConfigurationSchema({...childOptions});

    // ensure the child schema is property linked
    childSchema.parent = this;

    if (this.condition) {
      childSchema.condition = this.condition;
    }

    if (childSchema.linkedParentFieldName && !childSchema.linkedParentFieldValue) {
      childSchema.linkedParentFieldValue = name;
    }

    this.children.set(name, childSchema);
    this._fpCache = null;
    return childSchema;
  }

  /**
   * Make a copy of a schema that allows for field/child extension.  Fields are copied by reference.
   * @returns {ConfigurationSchema}
   */
  copy() {
    const cloneOptions = {}
    if (this.condition) {
      cloneOptions.condition = this.condition;
    }
    if (this.linkedParentFieldName) {
      cloneOptions.linkedParentFieldName = this.linkedParentFieldName;
      cloneOptions.linkedParentFieldValue = this.linkedParentFieldValue
    }

    let clone = new ConfigurationSchema(cloneOptions);

    for (let [fieldName, fieldOptions] of this.fields) {
      clone.field(fieldName, fieldOptions);
    }

    for (let [childName, childSchema] of this.children) {
      const newChildSchema = childSchema.copy();
      newChildSchema.parent = clone;
      clone.children.set(childName, newChildSchema);
    }

    return clone;
  }

  get path() {
    if (this.parent) {
      let parentPath = this.parent.path;
      for (let [childName, childSchema] of this.parent.children) {
        if (childSchema === this) {
          return parentPath? `${parentPath}.${childName}` : childName;
        }
      }
    }
    return '';
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
      for (let flag of ['inherit']) {
        if (fo[flag] === true && query[flag] !== true) {
          return true;  // some flags must be explicitly queried
        }
      }
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
      paths.set(fieldOptions.path, { ...fieldOptions });
    }

    for (const [childName, childSchema] of this.children) {
      const childPaths = childSchema.getAllFieldPaths(query);

      for (const [childFieldPath, childFieldOptions] of childPaths) {
        paths.set(childFieldPath, childFieldOptions);
      }

      /*
      for (const [relativePath, fieldOptions] of childPaths) {
        if (skip(fieldOptions)) {
          continue;
        }
        const fullPath = `${childName}.${relativePath}`;

        if (fullPath !== fieldOptions.path) {
          throw new ConfigurationSchemaError(`inconsistent field path ${fullPath} for child ${childName}`);
        }

        paths.set(fieldOptions.path, {
          ...fieldOptions
        })


      }
       */
    }
    this._fpCache = paths;
    return paths;

  }


  /** @typedef {{field: FieldOptions} | {child: string, configurables: [Configurable] }} Configurable
   */

  /**
   * Load declarative configurables into schema
   * @param {[Configurable]} configurables
   */
  loadConfigurables(configurables) {

    function processConfigurables(schema, configurables) {
      for (let configurable of configurables) {
        let c = {...configurable};

        if (configurable.field) {
          c.type = normalizeTypeName(configurable.type);
          schema.field(configurable.field, c)
        }
        else if (configurable.child) {
          let childSchema = schema.child(configurable.child, configurable);
          processConfigurables(childSchema, configurable.configurables ?? []);
        }
      }
    }

    processConfigurables(this, configurables);
    return this;
  }
}

function normalizeTypeName(typeName) {
  if (!typeName) {
    return 'string';
  }
  if (typeof typeName !== 'string') {
    throw new ConfigurationSchemaError(`Type name must be a string, got ${typeName}`);
  }

  typeName = typeName.trim();

  if (typeName.startsWith('[') && typeName.endsWith(']')) {
    const arrayType = toKebabCase(typeName.substring(1, typeName.length - 1).trim() || 'string');
    return `[${arrayType}]`;
  }
  else {
    return toKebabCase(typeName);
  }
}
