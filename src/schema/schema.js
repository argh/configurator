import { ConfiguratorError, SchemaError, ValidationError } from '../errors.js';
import { toData } from './helpers/to-data.js';
import { CompiledSchema } from './compiled-schema.js';
import { deepValue } from '../utils.js';

/** @import { ISchemaProperties, ISchemaMetadata, ISchemaOptions, SchemaValueProcessor, SchemaData, ISchema, ProcessorSpec } from './types.js' */

/** @typedef {ISchemaOptions} SchemaOptions */
/** @typedef {ISchemaMetadata} SchemaMetadata */
// This is stupid, but my IDE keeps preferring a global Schema reference over the local one:
/** @typedef {Object.<string, import('./schema.js').Schema>} SchemaProperties */
/** @typedef {Object.<string, import('./schema.js').Schema>} SchemaUnionSchemas */

/** @typedef {Object} SchemaHandlers
 * @property {Array<ProcessorSpec>} [normalizers]
 * @property {Array<ProcessorSpec>} [transformers]
 * @property {Array<ProcessorSpec>} [validators]
 * @property {Array<ProcessorSpec>} [serializers]
 * @property {Array<ProcessorSpec>} [conditions]
 * @property {SchemaValueProcessor<string|CompiledSchema|undefined>} [unionDiscriminator]
 */

/**
 * Schema - defines a valid configuration
 *
 * Essentially acts as a fluent builder, must be compiled by SchemaResolver for use.
 *
 * @typedef {import("./types.js").ISchema} ISchema
 * @implements {ISchema}
 */
export class Schema
{
  /**
   * Construct a Schema.  Pass a string name of a registered schema to resolve as the base,
   * or pass a schema-shaped object to extend.
   * @param {string|ISchema|SchemaData} [base] - schema type or base to extend
   * @param {Object} [options] - schema options (also supports "attribute" shorthand syntax, but prefer being explicit)
   * @param {ISchemaMetadata} [metadata] - schema metadata
   */
  constructor(base, options, metadata) {

    if (options || metadata) {
// FIXME      throw new Error('lets seee..')
    }
    /**
     * @type {Schema|undefined}
     * @internal
     */
    this._parent = undefined;

    /**
     * @type {string|undefined}
     * @internal
     */
    this._name = undefined;

    /**
     * @type {SchemaProperties}
     * @internal
     */
    this._properties = {};

    /**
     * @type {SchemaHandlers}
     * @private
     */
    this._handlers = {};

    /**
     * @type {SchemaOptions}
     * @internal
     */
    this._options = {};

    /**
     * @type {ISchemaMetadata}
     * @internal
     */
    this._metadata = {};

    /**
     * @type {SchemaUnionSchemas}
     * @internal
     */
    this._unionSchemas = {};

    if (typeof base === 'string') {
      this.base = base;
      if (options) {
        this._setAttributes(options);
      }
      if (metadata) {
        this.meta(metadata, true);
      }
    }
    else if ((base instanceof Schema) || (base instanceof CompiledSchema)) {
      this.extend(base);
      if (base instanceof Schema) {
        this.base = base.base;
      }
      // Apply additional options/metadata after extending
      if (options) {
        this._setAttributes(options);
      }
      if (metadata) {
        this.meta(metadata, true);
      }
    }
    else if (typeof base === 'object' && base !== null) {
      // It's a SchemaData/ISchema object
      this.extend(base);
    }
  }

  /**
   * parent schema
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
   * property name of this schema within its parent
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
   * name of a schema registered in SchemaResolver that this schema extends
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
   * computed path of this schema within the entire schema hierarchy
   * @returns {string}
   */
  get path() {
    if (!this.name) {
      return '';  // this is an unattached schema, no path.
    }
    let parent = this.parent;
    return parent?.path ? `${parent.path}.${this.name}` : `${this.name}`;
  }

  /**
   * named child schemas
   * @type {SchemaProperties}
   */
  get properties() {
    return this._properties;   // overridden just for type narrowing
  }

  /**
   * handlers
   * @type {SchemaHandlers}
   */
  get handlers() {
    return this._handlers;
  }

  /**
   * settings that define how the schema behaves
   * @returns {SchemaOptions}
   */
  get options() {
    return this._options;
  }

  /**
   * settings that describe how the schema should interact with users
   * @type {SchemaMetadata}
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * alternative schemas that make up this union
   * @type {SchemaUnionSchemas}
   */
  get unionSchemas() {
    return this._unionSchemas; // overridden just for type narrowing
  }

  /**
   * extract the contents of this schema and its children as a regular object
   * @returns {SchemaData}
   */
  toData() {
    return toData(this);
  }

  /**
   * attributes were a convenient shorthand, but they really just add confusion
   * @deprecated
   * @param {string} attributeName
   * @param {any} attributeValue
   * @returns {Schema}
   * @private
   * @internal
   */
  _setAttribute(attributeName, attributeValue) {
    if (attributeName === 'base') {
      this.base = attributeValue;
      return this;
    }
    else if (attributeName === 'metadata') {
      return this.addMetadata(attributeValue);
    }
    else if (attributeName === 'options') {
      return this.addOptions(attributeValue ?? {});
    }
    else if (attributeName === 'handlers') {
      return this.addHandlers(attributeValue ?? {});
    }
    else if (attributeName === 'properties') {
      return this.addProperties(attributeValue ?? {});
    }
    else if (attributeName === 'unionSchemas') {
      return this.addUnionSchemas(attributeValue ?? {})
    }
    else if (attributeName === 'value') {
      return this.value(attributeValue);
    }
    else if (attributeName === 'transformer') {
      return this.transformer(attributeValue);
    }
    else if (attributeName === 'normalizer') {
      return this.normalizer(attributeValue);
    }
    else if (attributeName === 'validator') {
      return this.validator(attributeValue)
    }
    else if (attributeName === 'condition') {
      return this.condition(attributeValue);
    }
    else if (attributeName === 'unionDiscriminator' || attributeName === 'discriminator') {
      return this.unionDiscriminator(attributeValue);
    }

    const parts = attributeName.split('.').map(p => p.trim());

    if (parts.length === 1) {
      if (attributeName.startsWith('_')) {
        // This was a terrible hack.  I'm still paying the price.  Don't use this approach.
        return this.meta(attributeName.slice(1), attributeValue);
      }
      else {
        return this.option(attributeName, attributeValue);
      }
    }
    else if (parts.length === 2) {
      throw new Error('UNSUPPORTED, KILL THIS!');  // FIXME
      /*
      if (parts[0] === 'option') {
        return this.option(parts[1], attributeValue);
      }
      else if ((parts[0] === 'meta') || (parts[0] === 'metadata')) {
        return this.meta(parts[1], attributeValue);
      }
      else if (parts[0] === 'handler') {
        return this.handler(parts[1], attributeValue)
      }
      else {
        throw new SchemaError(`Unknown attribute family "${parts[0]}"`)
      }
       */
    }
    throw new SchemaError(`Bad attribute "${attributeName}"`);
  }

  /**
   * attributes were a convenient shorthand, but they really just add confusion*
   * @deprecated
   * @param {Object} attributes
   * @returns {Schema}
   * @private
   * @internal
   */
  _setAttributes(attributes = {}) {
    if (typeof attributes !== 'object') {
      throw new SchemaError('Expected an object containing options and metadata attributes');
    }
    for (const [attributeName, attributeValue] of Object.entries(attributes)) {
      this._setAttribute(attributeName, attributeValue);
    }
    return this;
  }

  /**
   * property - add a named child schema
   * @param {string} propertyName - property name
   * @param {Schema|undefined} propertySchema - schema to associate with the property, undefined to delete current
   * @returns {Schema} - returns self for fluent chaining
   */
  property(propertyName, propertySchema) {
    if (typeof propertyName !== 'string') {
      throw new SchemaError('Properties must be associated with a valid name');
    }
    if (propertySchema instanceof CompiledSchema) {
      throw new SchemaError(`Unable to set property ${propertyName} to a compiled schema`);
    }
    if (!(propertySchema instanceof Schema)) {
      if (propertySchema === undefined) {
        delete this.properties[propertyName]?._name;
        delete this.properties[propertyName]?._parent;
        delete this.properties[propertyName];
        return this;
      }
      else {
        throw new SchemaError('Property value must be a schema');
      }
    }
    if (propertySchema === this) {
      throw new SchemaError('Cannot add self as a child schema');
    }
    if (propertySchema.parent) {
      if (propertySchema.parent === this) {
        return this;   // no-op
      }
      throw new SchemaError(`Cannot set property ${propertyName} to a schema that is already bound to a different parent`);
    }
    this.properties[propertyName] = propertySchema;
    propertySchema._name = propertyName;
    propertySchema._parent = this;

    if (this.base === undefined && this.options.type === undefined) {
      this.base = Number.isInteger(propertyName)? 'array' : 'object';
    }
    return this;
  }

  /**
   * bulk-add properties
   * @param {SchemaProperties} properties - property name
   * @param {boolean} [overwrite] - whether to overwrite existing properties
   * @returns {Schema} - returns self for fluent chaining
   * @internal
   */
  addProperties(properties, overwrite = false) {
    if (typeof properties !== 'object') {
      throw new SchemaError('Invalid properties definition');
    }
    for (const [key, schema] of Object.entries(properties)) {
      if (overwrite || this._properties[key] === undefined) {
        this.property(key, Schema.createFromModel(schema));
      }
    }
    return this;
  }

  /**
   * define a schema option
   * @param {string} option - option
   * @param {any} [value] - option value
   * @returns {Schema} - returns self for fluent chaining
   */
  option(option, value) {
    if (typeof option !== 'string') {
      throw new SchemaError('Options must be associated with a valid key');
    }
    else if (option.startsWith('_')) {
      throw new SchemaError('Option keys cannot have a leading underscore');
    }
    if (value === undefined) {
      value = true;
    }
    if (value === null) {
      delete this._options[option];
    }
    else {
      this._options[option] = value;
    }
    return this;
  }

  /**
   * bulk add options
   * @param {Object} options
   * @param {boolean} [overwrite]
   * @returns {Schema}
   * @internal
   */
  addOptions(options, overwrite = false) {
    if (typeof options !== 'object') {
      throw new SchemaError('Options definition must be an object');
    }
    for (const [key, value] of Object.entries(options)) {
      if (overwrite || this._options[key] === undefined) {
        this.option(key, value);
      }
    }
    return this;
  }

  /**
   *
   * @param {string} handlerName
   * @param {Array<ProcessorSpec>} processorSpecs
   * @returns {Schema}
   */
  handler(handlerName, processorSpecs) {
    if (typeof handlerName !== 'string') {
      throw new SchemaError('Handlers must be associated with a valid key');
    }
    if (processorSpecs === null) {
      delete this._handlers[handlerName];
      return this;
    }
    else if (processorSpecs === undefined) {
      return this;
    }
    if (!Array.isArray(processorSpecs)) {
      processorSpecs = [processorSpecs];
    }

    if (!Array.isArray(this._handlers[handlerName])) {
      this._handlers[handlerName] = [];
    }

    this._handlers[handlerName].push(...processorSpecs);

    return this;
  }

  /**
   * bulk add handlers
   * @param {Object} handlers
   * @param {boolean} [overwrite]
   * @returns {Schema}
   * @internal
   */
  addHandlers(handlers, overwrite = false) {
    if (typeof handlers !== 'object') {
      throw new SchemaError('Handlers definition must be an object')
    }

    for (const [key, value] of Object.entries(handlers)) {
      if (overwrite || this._handlers[key] === undefined) {
        this.handler(key, value);
      }
    }
    return this;
  }

  /**
   *
   * @param {Array<ProcessorSpec>} processorSpecs
   * @returns {Schema}
   */
  normalizers(processorSpecs) {
    return this.addHandlers({'normalizers': processorSpecs});
  }
  conditions(processorSpecs) {
    return this.addHandlers({'conditions': processorSpecs});
  }
  transformers(processorSpecs) {
    return this.addHandlers({'transformers': processorSpecs});
  }
  validators(processorSpecs) {
    return this.addHandlers({'validators': processorSpecs});
  }
  serializers(processorSpecs) {
    return this.addHandlers({'serializers': processorSpecs});
  }


  /**
   * define schema metadata (like options, but for humans and ConfigurationSource hints) - todo: locale-aware
   *
   * (Note: named "meta" instead of "metadata" to differentiate from the object getter)
   *
   * @param {string|Object} meta - metadata key
   * @param {any} [value] - option value
   * @returns {Schema} - returns self for fluent chaining
   */
  meta(meta, value) {

    if (typeof meta !== 'string') {
      throw new SchemaError('Metadata must be associated with a valid key');
    }
    if (value === undefined) {
      value = true;
    }
    if (value === null) {
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
   * Bulk-add metadata
   *
   * @param {Object} metadata
   * @param {boolean} [overwrite]
   * @returns {Schema}
   * @internal
   */
  addMetadata(metadata, overwrite = false) {
    if (typeof metadata !== 'object') {
      throw new SchemaError('Invalid metadata definition');
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (overwrite || this._metadata[key] === undefined) {
        this.meta(key, value);
      }
    }
    return this;
  }

  /**
   * define the property name (or function) this union will use as a discriminator
   * @param {string|SchemaValueProcessor<CompiledSchema|string|undefined>} discriminator - property name
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
   * add a schema as a member of this schema's union
   * @param {string} key - union schema key (used by some discriminators to select this schema)
   * @param {Schema} unionSchema - schema that the discriminator selects, or true/false override if a group
   * @returns {Schema}
   */
  unionSchema(key, unionSchema) {
    if (!(unionSchema instanceof Schema )) {
      throw new SchemaError(`Invalid schema for union member ${key}`);
    }
    if (unionSchema._name || unionSchema._parent) {
      throw new SchemaError(`Unable to associate union member ${key} with a schema that is already attached`);
    }

    if ((this.base === undefined/* || this.base === 'any'*/) && Object.keys(unionSchema.properties).length > 0) {
      this.base = (unionSchema.properties['*'] || unionSchema.properties['0']) ? 'array' : 'object';
    }

    this._unionSchemas[key] = unionSchema;

    // NOTE: the current schema might not have been attached yet, so we will set a dynamic lookup
    // on the union schemas
    const self = this;
    Object.defineProperty(unionSchema, 'name', {
      get() { return self.name },
      enumerable: true,
      configurable: true
    })
    Object.defineProperty(unionSchema, 'parent', {
      get() { return self.parent },
      enumerable: true,
      configurable: true
    })

    return this;
  }

  /**
   * Bulk-add union schemas
   * @param {Object.<string,Schema>} unionSchemas
   * @param {boolean} [overwrite]
   * @returns {Schema}
   * @internal
   */
  addUnionSchemas(unionSchemas, overwrite = false) {
    if (typeof unionSchemas !== 'object') {
      throw new SchemaError('Invalid union schemas object');
    }

    for (const [key, unionSchema] of Object.entries(unionSchemas)) {
      if (overwrite || this._unionSchemas[key] === undefined) {
        this.unionSchema(key, Schema.createFromModel(unionSchema));
      }
    }
    return this;
  }

  /**
   * mark this schema as a selector
   * @param {boolean} [value]
   * @returns {Schema}
   */
  selector(value) {
    this.options.selector = Boolean(value ?? true);
    return this;
  }

  /**
   * Mark this schema as a selection.  With the default argument, will compile to assume the property name
   * @param {NonNullable<any>} [value]
   * @returns {Schema}
   */
  selection(value) {
    this.options.selection = value ?? true;
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
   * Mark this array/string as allowing empty values
   * @param {boolean} [value]
   * @returns {Schema}
   */
  allowEmpty(value) {
    this.options.allowEmpty = value ?? true;
    return this;
  }

  /**
   * Mark this schema as allowing incremental assignment to children.
   * (The default is true for any schema with children, so most of the
   * time you'd be disabling it.)
   * @param {boolean} [value]
   * @returns {Schema}
   * @deprecated
   */
  allowIncremental(value) {
    this.options.allowIncremental = value ?? true;
    return this;
  }

  /**
   * Mark this schema as defining a value whose internal structure is hidden after transformation.
   *
   * This has implications both for assignment processing and validation.
   *
   * Deep property assignments usually result in any mid-path containers being automatically created
   * (normalized and transformed) and property values are incrementally assigned.
   *
   * Opaque schemas do not allow incremental assignments, so they only create normalized mid-path containers
   * that are staged until all relevant assignments are complete.  The transform is then run, and passed
   * the staged normalized container contents as input.
   *
   * Validators for opaque schemas only run on the value itself, and do not traverse into any child properties.
   *
   * @param {boolean} [value]
   */
  opaque(value = true) {
    this.options.allowIncremental = !value;
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
   * Mark this schema to inherit its value from a parent schema, and hide it while we're at it
   * @param {boolean} [value]
   * @returns {Schema}
   */
  inherit(value) {
    this.options.inherit = value ?? true;
    if (this.options.inherit) {
      this.metadata.hidden = true;
    }
    return this;
  }

  /**
   * Mark this schema as implicit in the transformed output (so no need to assign or check)
   * @param {boolean} [value]
   * @returns {Schema}
   */
  implicit(value) {
    this.options.implicit = value ?? true;
    return this;
  }


  /**
   * Define a legal value this schema can hold (simple === comparison only for now)
   * @param {NonNullable<any>} v
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
   * Define legal values this schema can hold (simple === comparison only for now)
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
   * Set the condition handler that determines if the schema should be processed at all
   * @param {SchemaValueProcessor<any>|boolean} c
   * @returns {Schema}
   */
  condition(c) {
    this.options.condition = c;


    if (!Array.isArray(this.handlers.conditions)) {
      this.handlers.conditions = [];
    }

    this.handlers.conditions.push(c);

    return this;
  }

  /**
   * Set the normalize handler that ensures input is in a format that the transformer can handle
   * @param {SchemaValueProcessor<any>} fn
   * @returns {Schema}
   */
  normalizer(fn) {
    if (typeof fn !== 'function') {
      throw new SchemaError('Normalizer must be a function');
    }
    this.options.normalizer = fn;

    if (!Array.isArray(this.handlers.normalizers)) {
      this.handlers.normalizers = [];
    }

    this.handlers.normalizers.push(fn);

    return this;
  }

  /**
   * Set the transform handler that converts an input value into the output value used in the final configuration
   * @param {SchemaValueProcessor<any>|NonNullable<any>} fn
   * @returns {Schema}
   */
  transformer(fn) {
    if (typeof fn !== 'function') {
//      throw new SchemaError('Transformer must be a function');
    }
    this.options.transformer = fn;

    if (!Array.isArray(this.handlers.transformers)) {
      this.handlers.transformers = [];
    }

    this.handlers.transformers.push(fn);


    return this;
  }

  /**
   * Set the validate handler that ensures an input value matches the schema, and returns a (potentially enhanced) fully validated output value
   * @param {ProcessorSpec} v
   * @returns {Schema}
   */
  validator(v) {
    this.options.validator = v;


    if (!Array.isArray(this.handlers.validators)) {
      this.handlers.validators = [];
    }
    this.handlers.validators.push(v);

    return this;
  }

  /**
   * Set the serialize handler that will restore a configuration value to its pre-transform normalized form
   * @param {SchemaValueProcessor<any>|NonNullable<any>} fn
   * @returns {Schema}
   */
  serializer(fn) {
    if (typeof fn !== 'function') {
//      throw new SchemaError('Serializer must be a function');
    }
    this.options.serializer = fn;

    if (!Array.isArray(this.handlers.serializers)) {
      this.handlers.serializers = [];
    }
    this.handlers.serializers.push(fn);

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

    // Set base if not already set
    if (!this.base && otherSchema.base) {
      this.base = otherSchema.base;
    }

    this.addProperties(Object.fromEntries(
      Object.entries(otherSchema.properties ?? {})
            .map(([propertyName, propertySchema]) => [propertyName, Schema.createFromModel(propertySchema)])));
    this.addUnionSchemas(Object.fromEntries(
      Object.entries(otherSchema.unionSchemas ?? {})
            .map(([unionKey, unionSchema]) => [unionKey, Schema.createFromModel(unionSchema)])));

    this.addOptions(otherSchema.options ?? {}, false);
    this.addMetadata(otherSchema.metadata ?? {}, false);
    this.addHandlers(otherSchema.handlers ?? {}, false);

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
   * Create a new Schema from something schema-shaped
   *
   * @param {ISchema|SchemaData|string} model
   * @returns {Schema}
   */
  static createFromModel(model) {
    if (typeof model === 'string') {
      return new Schema(model);
    }

    const schema = new Schema();

    if (model.base) {
      schema.base = model.base;
    }
    return schema.extend(model);
  }
  /**
   * Static schema factory (useful for aliasing to reduce typing!)
   * @param {string|ISchema|SchemaData|Schema|CompiledSchema} [base] - schema
   * @param {Object} [options] - schema options
   * @param {ISchemaMetadata} [metadata] - schema metadata
   * @returns {Schema}
   */
  static create(base, options, metadata) {
    return new Schema(base, options, metadata);
  }

  /**
   * Static schema factory for special schemas that ignore assignments and produce a single defined value
   * @param {NonNullable<any>} literalValue - the value this schema will always emit
   * @param {Object} [options] - additional options
   * @param {ISchemaMetadata} [metadata] - additional metadata
   * @returns {Schema}
   */
  static literal(literalValue, options, metadata) {
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

    const schema = new Schema(base)
      .option('values', [literalValue])
      .option('default', literalValue)
      .option('compileHook', (eventName, hookSchema) => {
        if (eventName === 'finalize') {
          const p = hookSchema.path ? ` at "${hookSchema.path}"` : ``;
          if (hookSchema.options.values?.length !== 1) {
            throw new SchemaError(`Literal schema${p} needs one value defined`);
          }
          if (hookSchema.hasChildren) {
            throw new SchemaError(`Literal schema${p} should not have child properties`)
          }
          if (hookSchema.isUnion) {
            throw new SchemaError(`Literal schema${p} should not be a union`)
          }
        }
      })
      .transformer((/** @type {any} */ value, _, /** @type {CompiledSchema} */ schema) => {
        return literalValue;
      })
      .validator((/** @type {any} */ value, _, /** @type {CompiledSchema} */ schema) => {
        if (value !== literalValue) {
          throw new ValidationError(`Expected literal ${JSON.stringify(literalValue)}`)
        }
        return literalValue;
      });

    if (options) {
      schema._setAttributes(options);
    }
    if (metadata) {
      schema.addMetadata(metadata, true);
    }

    return schema;
  }

  static inherit() {
    return new Schema()
      .option('compileHook', (hookEvent, hookSchema) => {
        if (hookEvent !== 'finalize') {
          return;
        }
        if (!hookSchema.parent) {
          throw new SchemaError('A top-level schema cannot have an inherited value');
        }
      })
      .normalizer((_value, _config, _schema, path) => {
        return path.substring(path.lastIndexOf('.') + 1);
      })
      .transformer((propName, config, schema, path) => {
        while (path && schema.parent) {
          schema = schema.parent;
          let lastDot = path.lastIndexOf('.');
          if (lastDot === -1) {
            path = '';
          }
          else {
            path = path.substring(0, lastDot);
          }
          if (schema.properties[propName]) {
            return deepValue(config, path ? `${path}.${propName}` : `${propName}`);
          }
        }
        return undefined;
      })
      .serializer(() => undefined)
      .default((_value, config, _schema, path) => {
        return path.substring(path.lastIndexOf('.') + 1)
      })
      .meta('omitFromSerialize')
      .meta('internal')
  }

  static reference(path) {
    return new Schema()
      .option('compileHook', (hookEvent, hookSchema) => {
        if (hookEvent !== 'finalize') {
          return;
        }
        if (!hookSchema.find(path)) {
          throw new SchemaError(`Unable to find reference path ${path}`);
        }
      })
      .normalizer(() => {
        return path;
      })
      .transformer((_, config) => {
        return deepValue(config, path);
      })
      .validator((value, config) => {
        const configValue = deepValue(config, path);
        if (configValue === value) { // fixme oh crap, there might be a different value where our reference points!  can't guarantee equality of reference!
          return configValue;
        }
        throw new ValidationError(`Reference is not exactly the same as ${path}`)
      })
      .serializer(() => undefined)
      .default(() => {
        return path;
      })
      .meta('omitFromSerialize')
      .meta('internal')
  }
}

