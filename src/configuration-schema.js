import { randomUUID } from 'node:crypto';
import { deepAssign, deepValue, toKebabCase } from './utils.js';
import { ConfiguratorError } from './configurator-error.js';

export class ConfigurationSchemaError extends ConfiguratorError {}



/** @typedef {FieldOptions & {name: string, path: string, schema: ConfigurationSchema}} FieldDefinition

/**
 * Configuration field definition and validation schema
 */
export class ConfigurationSchema {
  /**
   * @typedef {Object} SchemaOptions
   * @property {Function} [condition] - optional conditional to check before processing anything associated with this schema
   * @property {string} [selector] - optional field defined in the parent schema that must be set
   * @property {string} [selection] - optional value that must match in the field
   */

  /**
   * Create a new configuration schema
   *
   * @param {SchemaOptions} [options]
   */
  constructor(options) {
    /** @type {string} */
    this.id = randomUUID();

    /** @type {Map<string,FieldDefinition>} */
    this.fields = new Map();

    /** @type {Map<string,ConfigurationSchema>} */
    this.children = new Map();

    /** @type {Function|boolean|undefined} */
    this._condition = options?.condition;

    /** @type {ConfigurationSchema} */
    this.parent = null;

    /** @type {string} */
    this.selector = options?.selector;
    if (this.selector) {
      this.selection = toKebabCase(options?.selection);
    }
  }

  /** @typedef {Object} AssignmentValue
   * @property {*} value
   * @property {string} [description]
   */

  /** @typedef {Object} FieldOptions
   * @property {string} [type] - resolver name in the Types registry; defaults to "string".
   * @property {string} [name] - field name
   * @property {string} [path] - field path, relative to the schema root.
   * @property {Function|string|RegExp|object|undefined} validator - validator specification; see Validators.
   * @property {Function} [condition] - per-field conditional; overrides schema condition
   * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
   * @property {boolean} [inherit] - disallow direct assignment; value will be inherited from a parent
   * @property {boolean} [required] - flag indicating whether this field is required
   * @property {Array<AssignmentValue|*>} [values] - list of legal input values for this field
   * @property {any} [default] - default value; used by SchemaDefaultsSource.
   * @property {string} [description] - help text description; used by CommandLineSource
   * @property {string} [flagHint] - request a specific flag character; used by CommandLineSource
   * @property {boolean} [advanced] - filter from basic help text; used by CommandLineSource
   * @property {boolean} [hidden] - hide from help; used by CommandLineSource
   * @property {boolean} [general] - mark this field for CommandLineSource to be used without a flag or option
   * @property {boolean} [command] - mark this field for CommandLineSource as defining a command
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

    const typeName = normalizeTypeName(options.type);

    let fieldDefinition = {...options, name, type: typeName, required: options.required ?? false, description: options.description ?? '', schema: this };
    Object.defineProperty(fieldDefinition, 'path', {
      get: () => {
        return this.path? `${this.path}.${name}` : name;
      },
      enumerable: true
    })
    this.fields.set(name, fieldDefinition);
    return this;
  }

  /**
   * Define a child schema
   * @param {string} name - Child schema name, typically camelCase
   * @param {SchemaOptions|ConfigurationSchema} schemaOrOptions - schema to copy, or options for a new child schema
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


    if (childSchema.selector && !childSchema.selection) {
      childSchema.selection = toKebabCase(name);
    }

    if (childSchema.selector && !childSchema._condition) {
      childSchema._condition = (field, value, config) => {
        const fieldDefinition = this.fields.get(childSchema.selector);

        const command = deepValue(config, fieldDefinition?.path)

        return toKebabCase(command) === childSchema.selection;
      }
    }

    this.children.set(name, childSchema);
    return childSchema;
  }

  /**
   * Make a copy of a schema that allows for field/child extension.  Fields are copied by reference.
   * @returns {ConfigurationSchema}
   */
  copy() {
    const cloneOptions = {}
    if (this._condition) {
      cloneOptions._condition = this._condition;
    }
    if (this.selector) {
      cloneOptions.selector = this.selector;
      cloneOptions.selection = this.selection
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

  get condition() {
    return this._condition ?? this.parent?.condition;
  }
  set condition(value) {
    this._condition = value;
  }

  /**
   * Get all field definitions
   * @returns {Map<string,FieldDefinition>}
   */
  getFields() {
    return new Map(this.fields);
  }

  /**
   * Get child schema definitions
   * @returns {Map<string,ConfigurationSchema>}
   */
  getChildren() {
    return new Map(this.children);
  }

  /**
   * Find a field that has the specified tag
   * @param tag
   * @returns {FieldDefinition|undefined}
   */
  getTaggedField(tag) {
    for (const [fieldName, fieldOptions] of this.getAllFieldPaths()) {
      if (fieldOptions[tag]) {
        return fieldOptions;
      }
    }
    return undefined;
  }

  /**
   * Return map of entire schema hierarchy keyed by dotted field paths
   *
   * @param query
   * @returns {Map<string, FieldDefinition>}
   */
  getAllFieldPaths(query = {}) {
    const paths = new Map();

    function skip(fo = {}) {
      for (let flag of ['inherit']) {
        if (fo[flag] === true && query[flag] !== true) {
          return true;  // some flags must be explicitly queried
        }
      }
      for (let flag of ['hidden', 'advanced', 'system', 'internal']) {
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
    }
    return paths;

  }

  /**
   * Find a field definition by dotted path
   * @param path
   * @returns {FieldDefinition|undefined}
   */
  findField(path) {
    try {
      let schema = this;
      const parts = path.split('.');

      while (parts.length > 1) {
        schema = schema.children.get(parts.shift());
      }
      return schema.fields.get(parts.shift());
    }
    catch (_) {
      return undefined;
    }
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
