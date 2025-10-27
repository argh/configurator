import { SchemaError, ValidationError } from '../errors.js';
import { toData } from './helpers/to-data.js';
import { CompiledSchema } from './compiled-schema.js';

/** @import { ISchemaProperties, ISchemaMetadata, ISchemaOptions, ISchemaAttributes, SchemaValueFunction, SchemaData } from './types.js' */

/** @typedef {ISchemaOptions} SchemaOptions */
/** @typedef {ISchemaMetadata} SchemaMetadata */
/** @typedef {Object.<string, Schema>} SchemaProperties */
/** @typedef {Object.<any, Schema>} SchemaUnionSchemas */

/**
 * @typedef {import("./types.js").ISchema} ISchema
 * @implements {ISchema}
 */
export class Schema
{
  /**
   * @param {string|Object|Schema|CompiledSchema} [base] - schema
   * @param {ISchemaAttributes} [attributes]
   */
  constructor(base, attributes) {
    /** @type {Schema|undefined} */
    this._parent = undefined;

    /** @type {string|undefined} */
    this._name = undefined;

    /** @type {SchemaProperties} */
    this._properties = {};

    /** @type {SchemaOptions} */
    this._options = {};

    /** @type {ISchemaMetadata} */
    this._metadata = {};

    /** @type {SchemaUnionSchemas} */
    this._unionSchemas = {};

    if (typeof base === 'string') {
      this.base = base;
      attributes = attributes ?? {};
    }
    else if ((base instanceof Schema) || (base instanceof CompiledSchema)) {
      this.extend(base);
      if (base instanceof Schema) {
        this.base = base.base;
      }
      attributes = attributes ?? {};
    }
    else if (typeof base === 'object') {
      attributes = base;
    }

    this.setAttributes(attributes);
  }

  /**
   * @param {Schema} parent
   */
  set parent(parent) {
    this._parent = parent;
  }
  /** @type {Schema|undefined} */
  get parent() {
    return this._parent;
  }

  /**
   * @param {string} name
   */
  set name(name) {
    this._name = name;
  }

  /**
   * @returns {string|undefined}
   */
  get name() {
    return this._name;
  }

  /**
   * @param {string|undefined} base
   */
  set base(base) {
    this._base = base;
  }

  /**
   * @returns {string|undefined}
   */
  get base() {
    return this._base;
  }

  /**
   * @returns {string}
   */
  get path() {
    if (!this.name) {
      return '';  // this is an unattached schema, no path.
    }
    let parent = this.parent;
    return parent?.path ? `${parent.path}.${this.name}` : `${this.name}`;
  }

  /** @type {SchemaProperties} */
  get properties() {
    return this._properties;   // overridden just for type narrowing
  }

  /** @type {SchemaMetadata} */
  get metadata() {
    return this._metadata;
  }

  /** @type {SchemaUnionSchemas} */
  get unionSchemas() {
    return this._unionSchemas; // overridden just for type narrowing
  }

  /** @returns {SchemaOptions} */
  get options() {
    return this._options;
  }

  /**
   * @returns {Object<string, any>|undefined}
   */
  toData() {
    return toData(this);
  }

  /**
   * @param {string} attributeName
   * @param {any} attributeValue
   * @returns {Schema}
   * @private
   */
  _setAttribute(attributeName, attributeValue) {

    if (attributeName === 'base') {
      this.base = attributeValue;
      return this;
    }
    else if (attributeName === 'metadata') {
      if (typeof attributeValue !== 'object') {
        throw new SchemaError('Invalid metadata definition')
      }
      for (const [key, value] of Object.entries(attributeValue ?? {})) {
        this.meta(key, value);
      }
      return this;
    }
    else if (attributeName === 'options') {
      if (typeof attributeValue !== 'object') {
        throw new SchemaError('Invalid options definition')
      }
      for (const [key, value] of Object.entries(attributeValue ?? {})) {
        this.option(key, value);
      }
      return this;
    }
    else if (attributeName === 'properties') {
      if (typeof attributeValue !== 'object') {
        throw new SchemaError('Invalid properties definition')
      }
      for (const [key, value] of Object.entries(attributeValue ?? {})) {
        this.property(key, new Schema(value));
      }
      return this;
    }
    else if (attributeName === 'unionSchemas') {
      if (typeof attributeValue !== 'object') {
        throw new SchemaError('Invalid unionSchemas definition')
      }
      for (const [key, value] of Object.entries(attributeValue ?? {})) {
        this.unionSchema(key, new Schema(value));
      }
      return this;
    }
    else if (attributeName === 'value') {
      if (!this.options.values) {
        this.options.values = [];
      }
      this.options.values.push(attributeValue);
    }
    else if (attributeName === 'literal') {
      this.options.values = [attributeValue];
      this.metadata.literal = true;
    }

    const parts = attributeName.split('.').map(p => p.trim());

    if (parts.length === 1) {
      if (attributeName.startsWith('_')) {
        return this.meta(attributeName.slice(1), attributeValue);
      }
      else {
        return this.option(attributeName, attributeValue);
      }
    }
    else if (parts.length === 2) {
      if (parts[0] === 'option') {
        return this.option(parts[1], attributeValue);
      }
      else if ((parts[0] === 'meta') || (parts[0] === 'metadata')) {
        return this.meta(parts[1], attributeValue);
      }
      else {
        throw new SchemaError(`Unknown attribute family "${parts[0]}"`)
      }
    }
    throw new SchemaError(`Bad attribute "${attributeName}"`);
  }

  /**
   * @param {ISchemaAttributes} attributes
   * @returns {Schema}
   */
  setAttributes(attributes = {}) {
    if (typeof attributes !== 'object') {
      throw new SchemaError('Expected an object containing options and metadata attributes');
    }
    for (const [attributeName, attributeValue] of Object.entries(attributes)) {
      this._setAttribute(attributeName, attributeValue);
    }
    return this;
  }

  /**
   * property - define a property on this schema
   * @param {string|Object} property - property name
   * @param {Schema|any|undefined} value - schema to associate with the property
   * @returns {Schema} - returns self for fluent chaining
   */
  property(property, value) {
    if (typeof property === 'object') {
      if (value !== undefined) {
        if (value !== true && value !== false) {
          throw new SchemaError('Property group overwrite setting must be true, false, or undefined');
        }
      }
      const overwrite = value ?? true;

      for (const [key, value] of Object.entries(property)) {
        if (overwrite || this._properties[key] === undefined) {
          this.property(key, value);
        }
      }
      return this;
    }

    if (typeof property !== 'string') {
      throw new SchemaError('Properties must be associated with a valid name');
    }
    const current = this._properties[property];

    if (current) {
      if (current === this) {
        return this;  // no-op
      }
      delete current._name;
      delete current._parent;
    }
    if (value === undefined) {
      delete this._properties[property];
    }
    else if (value instanceof Schema) {
      if (value._name || value._parent) {
        throw new SchemaError(`Unable to set property ${property} to a schema that is already attached`);
      }
      this._properties[property] = value;
      value._name = property;
      value._parent = this;
    }
    else if (value instanceof CompiledSchema) {
      throw new SchemaError(`Unable to set property ${property} to a compiled schema`);
    }
    else {
      throw new SchemaError(`Invalid schema for property ${property}`);
    }

    return this;
  }

  /**
   * option - define a schema option
   * @param {string|Object} option - option
   * @param {any} value - option value
   * @returns {Schema} - returns self for fluent chaining
   */
  option(option, value) {
    if (typeof option === 'object') {
      if (value !== undefined) {
        if (value !== true && value !== false) {
          throw new SchemaError('Options group overwrite setting must be true, false, or undefined');
        }
      }
      const overwrite = value ?? true;

      for (const [key, value] of Object.entries(option)) {
        if (overwrite || this._options[key] === undefined) {
          this.option(key, value);
        }
      }
      return this;
    }
    else if (typeof option !== 'string') {
      throw new SchemaError('Options must be associated with a valid key');
    }
    else if (option.startsWith('_')) {
      throw new SchemaError('Options cannot have a leading underscore');
    }
    if (value === undefined) {
      delete this._options[option];
    }
    else {
      this._options[option] = value;
    }
    return this;
  }

  /**
   * meta - define schema metadata (like options, but for humans) - todo: locale-aware
   *
   * (Note: named "meta" instead of "metadata" to differentiate from the object getter)
   *
   * @param {string|Object} meta - metadata key
   * @param {any} value - option value
   * @returns {Schema} - returns self for fluent chaining
   */
  meta(meta, value) {
    if (typeof meta === 'object') {
      if (value !== undefined) {
        if (value !== true && value !== false) {
          throw new SchemaError('Metadata group overwrite setting must be true, false, or undefined');
        }
      }
      const overwrite = value ?? true;

      for (const [key, value] of Object.entries(meta)) {
        if (overwrite || this._metadata[key] === undefined) {
          this.meta(key, value);
        }
      }
      return this;
    }
    if (typeof meta !== 'string') {
      throw new SchemaError('Metadata must be associated with a valid key');
    }
    if (value === undefined) {
      delete this._metadata[meta];
    }
    else {
      if (meta.startsWith('_')) {
        meta = meta.slice(1);
      }
      this._metadata[meta] = value;
    }
    return this;
  }

  /**
   * unionDiscriminator - define the property name this union will use as a discriminator
   * @param {string|SchemaValueFunction<CompiledSchema>} discriminator - property name
   * @returns {Schema} - returns self for fluent chaining
   */
  unionDiscriminator(discriminator) {
    if (typeof discriminator !== 'function' && typeof discriminator !== 'string') {
      throw new SchemaError(`Unsupported union discriminator "${discriminator}"`)
    }
    this._options.discriminator = discriminator;
    return this;
  }

  /**
   * unionSchema - define a schema to be a member of the union
   * @param {string|Object} def - value that the discriminator should have to select this schema
   * @param {Schema|boolean} value - schema that the discriminator selects, or true/false override if a group
   * @returns {Schema}
   */
  unionSchema(def, value) {
    if (typeof def === 'object') {
      if (value !== undefined) {
        if (value !== true && value !== false) {
          throw new SchemaError('Union schema group overwrite setting must be true, false, or undefined');
        }
      }
      const overwrite = value ?? true;

      for (const [key, value] of Object.entries(def)) {
        if (overwrite || this._unionSchemas[key] === undefined) {
          this.unionSchema(key, value);
        }
      }
      return this;
    }

    const schema = /** @type {Schema} */ (value);

    if (!(schema instanceof Schema )) {
      throw new SchemaError(`Invalid schema for union member ${def}`);
    }
    if (schema._name || schema._parent) {
      throw new SchemaError(`Unable to associate union member ${def} with a schema that is already attached`);
    }

    if ((this.base === undefined || this.base === 'any') && Object.keys(schema.properties).length > 0) {
      this.base = (schema.properties['*'] || schema.properties['0']) ? 'array' : 'object';
    }

    this._unionSchemas[def] = schema;

    // NOTE: the current schema might not have been attached yet, so we will set a dynamic lookup
    // on the union schemas
    const self = this;
    Object.defineProperty(schema, 'name', {
      get() { return self.name },
      enumerable: true,
      configurable: true
    })
    Object.defineProperty(schema, 'parent', {
      get() { return self.parent },
      enumerable: true,
      configurable: true
    })

    return this;
  }

  /**
   * Mark this schema as required (or not)
   * @param {boolean} [value]
   * @returns {Schema}
   */
  required(value) {
    this.options.required = value ?? true;
    return this;
  }

  /**
   * Define a default value for this schema
   * @param {NonNullable<any>} value
   */
  default(value) {
    this.options.default = value;
    return this;
  }

  /**
   * Mark this schema as requiring strict enforcement (the default)
   * @param {boolean} [value]
   * @returns {Schema}
   */
  strict(value) {
    this.options.strict = value ?? true;
    return this;
  }

  /**
   * Syntactic sugar for the oppositive of strict
   * @param {boolean} [value];
   * @returns {Schema}
   */

  lax(value) {
    this.options.strict = (value === undefined) ? false : !value;
    return this;
  }


  /**
   * define a legal value this schema can hold (simple === comparison only for now)
   * todo: consider expanding types and using deep comparison?
   * @param {string|number|boolean} v
   * @returns {Schema}
   */
  value(v) {
    if (!Array.isArray(this.options.values)) {
      this.options.values = [];
    }
    if (v !== undefined) {
      this.options.values.push(v);
    }
    return this;
  }

  /**
   * define legal values this schema can hold (simple === comparison only for now)
   * todo: consider expanding types and using deep comparison?
   * @param {Array<NonNullable<any>>} va
   * @returns {Schema}
   */
  values(va) {
    if (!Array.isArray(this.options.values)) {
      this.options.values = [];
    }
    this.options.values.push(...va);

    return this;
  }
  /**
   * @param {SchemaValueFunction<any>} fn
   * @returns {Schema}
   */
  normalizer(fn) {
    if (typeof fn !== 'function') {
      throw new SchemaError('Normalizer must be a function');
    }
    this.options.normalizer = fn;
    return this;
  }

  /**
   * @param {SchemaValueFunction<any>|NonNullable<any>} fn
   * @returns {Schema}
   */
  transformer(fn) {
    if (typeof fn !== 'function') {
//      throw new SchemaError('Transformer must be a function');
    }
    this.options.transformer = fn;
    return this;
  }

  /**
   * @param {SchemaValueFunction<any>|string|object|RegExp} v
   * @returns {Schema}
   */
  validator(v) {
    this.options.validator = v;
    return this;
  }

  /**
   * @param {SchemaValueFunction<any>|NonNullable<any>} fn
   * @returns {Schema}
   */
  serializer(fn) {
    if (typeof fn !== 'function') {
//      throw new SchemaError('Serializer must be a function');
    }
    this.options.serializer = fn;
    return this;
  }

  /**
   * extend - use another schema to extend the current one without overwriting.
   * @param {ISchema|SchemaData} otherSchema - source schema
   * @returns {Schema} - returns self
   */
  extend(otherSchema) {
    if (typeof otherSchema !== 'object') {
      throw new SchemaError(`Invalid schema to extend`)
    }
    // Merge properties (local properties take precedence)
    for (const [key, value] of Object.entries(otherSchema.properties ?? {})) {
      if (!this._properties.hasOwnProperty(key)) {
        this.property(key, Schema.createFromModel(value));
      }
    }

    // we can use the bulk-write for these since we just want the existing values
    this.option(otherSchema.options ?? {}, false);
    this.meta(otherSchema.metadata ?? {}, false);

    // Merge union schemas
    for (const [key, value] of Object.entries(otherSchema.unionSchemas ?? {})) {
      if (this._unionSchemas[key] === undefined && value !== undefined) {
        this.unionSchema(key, Schema.createFromModel(value));
      }
    }
    return this;
  }

  /**
   * clone - make a copy of this schema
   * @returns {Schema}
   */
  clone() {
    return Schema.createFromModel(this);
  }

  /**
   * Create a new Schema from another
   *
   * @param {ISchema|SchemaData} model
   * @returns {Schema}
   */
  static createFromModel(model) {
    const schema = new Schema();

    if (model.base) {
      schema.base = model.base;
    }
    return schema.extend(model);
  }
  /**
   * @param {string|Object|Schema|CompiledSchema} [base] - schema
   * @param {object} [attributes]
   * @returns {Schema}
   */
  static create(base, attributes) {
    return new Schema(base, attributes);
  }

  /**
   *
   * @param {NonNullable<any>} literalValue
   * @param {ISchemaAttributes} [attributes]
   * @returns {Schema}
   */
  static literal(literalValue, attributes) {

    let base = 'any';
    if (typeof literalValue === 'string') {
      base = 'string';
    }
    else if (typeof literalValue === 'number') {
      base = 'number';
    }
    else if (typeof literalValue === 'boolean') {
      base = 'boolean';
    }

    const schema = new Schema(base, {
      ...attributes,
      literal: true,
      values: [literalValue],
      default: literalValue,
      transformer: (/** @type {any} */ value, _, /** @type {CompiledSchema} */ schema) => {
        //return schema.options.values?.[0];
        return literalValue;
      },
      validator: (/** @type {any} */ value, _, /** @type {CompiledSchema} */ schema) => {
        if (value !== literalValue) {
          throw new ValidationError(`Expected literal ${JSON.stringify(literalValue)}`)
        }
        return literalValue;
      },
    })

    return schema;
  }
}

