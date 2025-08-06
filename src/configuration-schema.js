import { randomUUID } from 'node:crypto';
import { deepAssign, toKebabCase } from './utils.js';
import { ConfiguratorError } from './configurator-error.js';

export class ConfigurationSchemaError extends ConfiguratorError {}

/**
 * Configuration field definition and validation schema
 */
export class ConfigurationSchema {
  /**
   * @typedef {Object} SchemaOptions
   * @property {Function} [condition] - optional conditional to check before processing anything associated with this schema
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
    this.condition = options?.condition;
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
   */
  field(name, options = {}) {

    //name = toCamelCase(name);  // normalize

    if (this.fields.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema field ${name} already defined`);
    }

    if (this.children.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema field ${name} already defined as a child schema`);
    }

    // todo - allow private extended options and don't smoosh everything together into one object

    let fieldOptions = {...options, name, type: options.type?.trim() || 'string', required: options.required ?? false, description: options.description ?? ''};

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
      throw new ConfigurationSchemaError(`configuration schema child ${name} already defined`);
    }
    if (this.fields.has(name)) {
      throw new ConfigurationSchemaError(`configuration schema child ${name} already defined as a field`);
    }

    const childSchema = new ConfigurationSchema({...options, condition: options.condition ?? this.condition});

    this.children.set(name, childSchema);
    this._fpCache = null;
    return childSchema;
  }

  /**
   * Make a copy of a schema that allows for field/child extension.  Fields are copied by reference.
   * @returns {ConfigurationSchema}
   */
  copy() {
    let clone = new ConfigurationSchema({condition: this.condition});

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
      paths.set(fieldName, { ...fieldOptions, path: fieldName, schema: this });
    }

    for (const [childName, childSchema] of this.children) {
      const childPaths = childSchema.getAllFieldPaths(query);

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


  /** @typedef {{field: FieldOptions} | {child: string, configurables: [Configurable] }} Configurable
   */

  /**
   * Create a new configuration schema
   * @param {[Configurable]} configurables
   * @param {ConfigurationSchema} [schema]
   * @param {SchemaOptions} [options]
   */
  static build(configurables, schema, options) {

    if (!schema) {
      schema = new ConfigurationSchema(options);
    }

    function processConfigurables(schema, configurables) {
      for (let configurable of configurables) {
        let c = {...configurable};

        if (configurable.field) {
          if (!configurable.type) {
            c.type = 'string';
          }
          else if (typeof configurable.type === 'function') {
            // todo - kill this code path, as it doesn't really know about module names
            const moduleName = toKebabCase(configurable.type.prototype?.constructor?.name);
            // moved out of module manager, so we can't really trust this name...
            //const moduleName = toKebabCase(getModuleSetting(configurable.type, 'name') ?? configurable.type?.name);

            if (!moduleName) {
              throw new ConfiguratorError(`unable to determine a type name for "${configurable.type}"`)
            }
            c.type = moduleName;
          }
          else {
            if (configurable.type.startsWith('[') && configurable.type.endsWith(']')) {
              const arrayType = toKebabCase(configurable.type.substring(1, configurable.type.length - 1).trim() || 'string');
              c.type = `[${arrayType}]`;
            }
            else {
              c.type = toKebabCase(configurable.type);
            }
          }

          schema.field(configurable.field, c)

//      if (configurable.type === 'module') {
//        dependencies.add(configurable.moduleName ?? toKebabCase(configurable.field));
//      }
        }
        else if (configurable.child) {
          let childSchema = schema.child(configurable.child, configurable);
          processConfigurables(childSchema, configurable.configurables);
        }
        // todo - handle errors and weird values
      }
//  return dependencies;
    }


    return processConfigurables(schema, options);

  }
}

