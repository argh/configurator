import { toData } from './helpers/to-data.js';
import { CompiledSchema } from './compiled-schema.js';
import { deepValue } from '../utils.js';
import { SchemaError, ValidationError } from './schema-errors.js';

/** @import { ValueProcessor, ValueProcessorFunction, ValueProcessorSpec } from './value-processor/value-processor.js' */
/** @import { ISchemaProperties, ISchemaMetadata, ISchemaOptions, SchemaData, ISchema, } from './types.js' */

/** @typedef {ISchemaOptions} SchemaOptions */
/** @typedef {ISchemaMetadata} SchemaMetadata */
/** @typedef {{[key:string]: ISchema}} SchemaProperties */
/** @typedef {{[key:string]: ISchema}} SchemaUnionSchemas */

/**
 * @typedef {object} SchemaHandlers
 * @property {Array<ValueProcessorSpec>} [normalizers]
 * @property {Array<ValueProcessorSpec>} [transformers]
 * @property {Array<ValueProcessorSpec>} [validators]
 * @property {Array<ValueProcessorSpec>} [serializers]
 * @property {Array<ValueProcessorSpec>} [conditions]
 * @property {Array<ValueProcessorSpec>} [discriminators]
 */

/**
 * Schema - defines a valid configuration
 *
 * Essentially acts as a fluent builder, must be compiled by SchemaCompiler for use.
 *
 * @typedef {import("./types.js").ISchema} ISchema
 * @augments {ISchema}
 */
export class Schema
{
  /** @type {string|undefined} */
  #base;

  /** @type {SchemaProperties} */
  #properties = {};

  /** @type {SchemaHandlers} */
  #handlers = {};

  /** @type {SchemaOptions} */
  #options = {};

  /** @type {ISchemaMetadata} */
  #metadata = {};

  /**@type {SchemaUnionSchemas} */
  #unionSchemas = {};

  /**
   * Construct a Schema.
   *
   * Pass a string name of a registered schema to resolve as the base, or pass a schema-shaped object to extend.
   *
   * Prefer the fluent setters over passing in options/metadata or attributes.
   *
   * @param {string|ISchema|SchemaData} [base] - schema type or base to extend
   * @param {object} [options] - schema options (also supports "attribute" shorthand syntax, but prefer being explicit)
   * @param {ISchemaMetadata} [metadata] - schema metadata
   */
  constructor(base, options, metadata) {
    if (typeof base === 'string') {
      this.base = base;
      if (options) {
        this._setAttributes(options);
      }
      if (metadata) {
        this.addMetadata(metadata);
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
        this.addMetadata(metadata);
      }
    }
    else if (typeof base === 'object' && base !== null) {
      // It's a SchemaData/ISchema object
      this.extend(base);
    }
  }

  /**
   * Name of a schema registered in SchemaResolver that this schema extends
   *
   * @type {string|undefined}
   */
  get base() {
    return this.#base;
  }
  set base(base) {
    this.#base = base;
  }

  /**
   * Properties are named child schemas.
   *
   * Use the property setter rather than direct access to ensure data consistency.
   *
   * @type {SchemaProperties}
   */
  get properties() {
    return this.#properties;
  }

  /**
   * Handlers are grouped lists of value processors.
   *
   * Assign using the individual value processor setters.
   *
   * @type {SchemaHandlers}
   */
  get handlers() {
    return this.#handlers;
  }

  /**
   * Options are settings that define how the schema behaves.
   *
   * @returns {SchemaOptions}
   */
  get options() {
    return this.#options;
  }

  /**
   * Metadata defines settings that describe how the schema should interact with users.
   *
   * @type {SchemaMetadata}
   */
  get metadata() {
    return this.#metadata;
  }

  /**
   * Unions are sets of alternative schemas; a discriminator selects which to use.
   *
   * @type {SchemaUnionSchemas}
   */
  get unionSchemas() {
    return this.#unionSchemas; // overridden just for type narrowing
  }

  /**
   * Extract the contents of this schema and its children as a regular object.
   *
   * @returns {SchemaData}
   */
  toData() {
    return toData(this);
  }

  /**
   * Attributes were initially a convenient shorthand for constructing schemas, but now just add confusion.
   *
   * @deprecated
   * @param {string} attributeName
   * @param {any} attributeValue
   * @returns {Schema}
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
    else if (Object.getPrototypeOf(this)?.hasOwnProperty(attributeName)) {
      if (!(typeof this[attributeName] === 'function')) {
        throw new SchemaError('Unknown attribute!')
      }
      try {
        return this[attributeName].call(this, attributeValue);
      }
      catch (error) {
        // ignore
      }
    }

    if (attributeName.startsWith('_')) {
      // This was a terrible hack.  I'm still paying the price.  Don't use this approach.
      return this.meta(attributeName.slice(1), attributeValue);
    }
    else {
      return this.option(attributeName, attributeValue);
    }
  }

  /**
   * Attributes were initially a convenient shorthand for constructing schemas, but now just add confusion.
   *
   * @deprecated
   * @param {object} attributes
   * @returns {Schema}
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
   * Attach a named child schema
   *
   * @param {string} propertyName - property name
   * @param {Schema|CompiledSchema|string|undefined} propertySchema - schema to associate with the property, undefined to delete current
   * @returns {Schema} - returns self for fluent chaining
   */
  property(propertyName, propertySchema) {
    if (typeof propertyName !== 'string') {
      throw new SchemaError('Properties must be associated with a valid name');
    }
    if (propertySchema === 'string') {
      // you usually wouldn't want to do this because you almost always want to edit the property schema
      propertySchema = new Schema(propertySchema);
    }

    if (!(propertySchema instanceof Schema) && !(propertySchema instanceof CompiledSchema)) {
      if (propertySchema === undefined) {
        delete this.properties[propertyName];
        return this;
      }
      else {
        throw new SchemaError('Property value must be a schema');
      }
    }
    this.properties[propertyName] = propertySchema;

    // If you don't want the default object/array because their validation rules don't match your intent,
    // either use "any" as the base, or explicitly set options.type ahead of time so that it's clear you
    // know what you're doing.  TODO - probably should only check this during compilation so that order doesn't matter!
    if (this.base === undefined && this.options.type === undefined) {
      //this.base = Number.isInteger(propertyName)? 'array' : 'object';
    }
    return this;
  }

  /**
   * Bulk-add properties
   *
   * @param {SchemaProperties} properties - property name
   * @param {symbol} [policy] - specify whether to overwrite or only initialize
   * @returns {Schema} - returns self for fluent chaining
   * @internal
   */
  addProperties(properties, policy = SchemaPolicy.INITIALIZE) {
    if (typeof properties !== 'object') {
      throw new SchemaError('Invalid properties definition');
    }
    for (const [key, schema] of Object.entries(properties)) {
      if (policy === SchemaPolicy.OVERWRITE || this.properties[key] === undefined) {
        this.property(key, Schema.createFromModel(schema));
      }
    }
    return this;
  }

  /**
   * Define a schema option
   *
   * Options are settings that define how the schema behaves.
   *
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
      delete this.options[option];
    }
    else {
      this.options[option] = value;
    }
    return this;
  }

  /**
   * Bulk add options
   *
   * @param {object} options
   * @param {symbol} [policy]
   * @returns {Schema}
   * @internal
   */
  addOptions(options, policy = SchemaPolicy.INITIALIZE) {
    if (policy !== SchemaPolicy.INITIALIZE && policy !== SchemaPolicy.OVERWRITE) {
      throw new SchemaError('Unsupported policy');
    }

    if (typeof options !== 'object') {
      throw new SchemaError('Options definition must be an object');
    }
    for (const [key, value] of Object.entries(options)) {
      if (policy === SchemaPolicy.OVERWRITE || this.options[key] === undefined) {
        this.option(key, value);
      }
    }
    return this;
  }

  /**
   * Helper function for the fluent handler api calls
   *
   * @param {string} handlerName
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   * @private
   */
  handler(handlerName, specs = [], policy = SchemaPolicy.APPEND) {
    if (typeof handlerName !== 'string') {
      throw new SchemaError('Handlers must be associated with a valid key');
    }
    if (!Object.values(SchemaPolicy).includes(policy)) {
      throw new SchemaError('Unknown policy');
    }
    if (specs === undefined) {
      if (policy === SchemaPolicy.OVERWRITE) {
        delete this.handlers[handlerName];
      }
      return this;
    }
    if (!Array.isArray(specs)) {
      specs = [specs];
    }
    if (policy === SchemaPolicy.INITIALIZE && Array.isArray(this.handlers[handlerName])) {
      return this;
    }
    if (policy === SchemaPolicy.OVERWRITE || policy === SchemaPolicy.INITIALIZE) {
      this.handlers[handlerName] = specs;
      return this;
    }
    if (!Array.isArray(this.handlers[handlerName])) {
      this.handlers[handlerName] = [];
    }
    if (policy === SchemaPolicy.PREPEND) {
      this.handlers[handlerName].unshift(...specs);
    }
    else {
      this.handlers[handlerName].push(...specs);
    }
    return this;
  }

  /**
   * Bulk add handlers
   *
   * @param {object} handlers
   * @param {symbol} [policy]
   * @returns {Schema}
   * @internal
   */
  addHandlers(handlers, policy = SchemaPolicy.INITIALIZE) {
    if (typeof handlers !== 'object') {
      throw new SchemaError('Handlers definition must be an object')
    }
    for (const [key, value] of Object.entries(handlers)) {
      this.handler(key, value, policy);
    }
    return this;
  }

  /**
   * Define schema metadata (like options, but for humans and ConfigurationSource hints) - todo: locale-aware
   *
   * (Note: named "meta" instead of "metadata" to differentiate from the object getter)
   *
   * @param {string} meta - metadata key
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
      delete this.metadata[meta];
    }
    else {
      if (meta.startsWith('_')) {
        meta = meta.slice(1);
      }
      this.metadata[meta] = value;
    }
    return this;
  }

  /**
   * Bulk-add metadata
   *
   * @param {object} metadata
   * @param {symbol} [policy]
   * @returns {Schema}
   * @internal
   */
  addMetadata(metadata, policy = SchemaPolicy.INITIALIZE) {
    if (typeof metadata !== 'object') {
      throw new SchemaError('Invalid metadata definition');
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (policy === SchemaPolicy.OVERWRITE || this.metadata[key] === undefined) {
        this.meta(key, value);
      }
    }
    return this;
  }

  /**
   * The discriminator handler returns the key or schema of the union member that should be used
   * This function appends a single value processor to the handler pipeline.
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema} - returns self for fluent chaining
   */
  unionDiscriminator(spec) {
    return this.unionDiscriminators(spec);
  }

  /**
   * The discriminator handler returns the key or schema of the union member that should be used
   * This function applies multiple value processors to the handler pipeline.
   * (Note that it would be highly unusual to want more than one!)
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema} - returns self for fluent chaining
   */
  unionDiscriminators(specs, policy) {
    return this.handler('discriminators', specs, policy);
  }

  /**
   * Add a schema as an alternative member of this schema's union.
   *
   * @param {string} key - union schema key (used by some discriminators to select this schema)
   * @param {Schema|CompiledSchema} unionSchema - schema that the discriminator selects, or true/false override if a group
   * @returns {Schema}
   */
  unionSchema(key, unionSchema) {

    if (!(unionSchema instanceof Schema || unionSchema instanceof CompiledSchema)) {
      throw new SchemaError(`Invalid schema for union member ${key}`);
    }
    this.unionSchemas[key] = unionSchema;

    return this;
  }

  /**
   * Bulk-add union schemas
   *
   * @param {SchemaUnionSchemas} unionSchemas
   * @param {symbol} [policy]
   * @returns {Schema}
   * @internal
   */
  addUnionSchemas(unionSchemas, policy = SchemaPolicy.INITIALIZE) {
    if (policy !== SchemaPolicy.INITIALIZE && policy !== SchemaPolicy.OVERWRITE) {
      throw new SchemaError('Unsupported policy');
    }

    if (typeof unionSchemas !== 'object') {
      throw new SchemaError('Invalid union schemas object');
    }

    for (const [key, unionSchema] of Object.entries(unionSchemas)) {
      if (policy === SchemaPolicy.OVERWRITE || this.unionSchemas[key] === undefined) {
        this.unionSchema(key, Schema.createFromModel(unionSchema));
      }
    }
    return this;
  }

  /**
   * Mark this schema as containing (and only permitting) storage of union keys.
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  unionKey(value) {
    this.options.unionKey = Boolean(value ?? true);
    return this;
  }

  /**
   * Mark this schema as a selector.
   *
   * Selectors are a convenience wrapper for controlling selection conditions that only are true when
   * the selector contains the correct selection value.
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  selector(value) {
    this.options.selector = Boolean(value ?? true);

    return this;
  }

  /**
   * Mark this schema as a selection.
   *
   * A selection schema automatically creates a condition that only activates the schema if the corresponding
   * selector has the correct value.
   *
   * With the default argument, the selection schema condition uses the property name as the selector value.
   *
   * @param {NonNullable<any>} [value]
   * @returns {Schema}
   */
  selection(value) {
    this.options.selection = value ?? true;
    // fixme
    this.condition(async (_, target, location) => {
      if (!location.schema.isSelection) {
        throw new SchemaError(`Conditional expected a selection schema!`, {location});
      }

      const selectionValue = (this.options.selection === true)? location.name : this.options.selection;

      const selectorLocation = await location.parent?.findPropertyLocation(pl => pl.schema.isSelector)

      if (selectorLocation) {
        const ss = selectorLocation.schema;
        const selectorValue = deepValue(target, selectorLocation.path);
        return (await ss.normalizeValue(selectorValue, target, selectorLocation) === (await ss.normalizeValue(selectionValue, target, selectorLocation)));
      }
      return false;
    })

    return this;
  }

  /**
   * Mark this schema as defining a required value (or not)
   *
   * Schema requirements are enforced during validation.
   *
   * Requirements are shallow; this can be changed via the deep() option.
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  required(value) {
    this.options.required = value ?? true;
    return this;
  }

  /**
   * Define a default value for this schema to use if there is no input.
   *
   * Defaults are shallow and will not cause children of undefined inputs to populate;
   * this can be changed via the deep() option.
   *
   * @param {NonNullable<any>|ValueProcessorFunction|ValueProcessor} value
   * @returns {Schema}
   */
  default(value) {
    this.options.default = value;
    return this;
  }

  /**
   * Indicate that this schema should be deeply traversed even if the input is empty
   * (e.g. to enable deep defaults and requirements)
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  deep(value) {
    this.options.deep = value ?? true;
    return this;
  }

  /**
   * Mark this array/string as allowing empty values.
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  allowEmpty(value) {
    this.options.allowEmpty = value ?? true;
    return this;
  }

  /**
   * Mark this schema as allowing incremental assignment to children.
   *
   * (The default is true for any schema with children, so most of the time you'd be disabling it.)
   *
   * Deprecated; use the "opaque" option as it more clearly indicates the actual intent.
   *
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
   * Opaque schemas thus generally require custom validators that know how to properly handle the value.
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  opaque(value = true) {
    this.options.allowIncremental = !value;
    return this;
  }

  /**
   * Mark this schema as requiring strict enforcement (the default)
   *
   * Strict mode means that the data cannot have any extra data, and exactly matches the schema definition.
   * Lax mode allows a more "fuzzy" interpretation of the data, but the data still must pass all value processors
   * including the validation phases.  (To prevent exceptions during validation, wrap the processors in a
   * $filter, which will just return undefined.)
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  strict(value) {
    this.options.strict = value ?? true;
    return this;
  }

  /**
   * Syntactic sugar for the oppositive of strict
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  lax(value) {
    this.options.strict = (value === undefined) ? false : !value;
    return this;
  }

  /**
   * Mark this schema as implicit in the transformed output (so no need to assign or check)
   *
   * @param {boolean} [value]
   * @returns {Schema}
   */
  implicit(value) {
    this.options.implicit = value ?? true;
    return this;
  }


  /**
   * Define a legal input value this schema will accept.
   *
   * Values will be normalized for comparison.
   *
   * @param {NonNullable<any>} v
   * @returns {Schema}
   */
  value(v) {
    return this.values([v])
  }

  /**
   * Define a list of one or more legal values this schema will accept
   *
   * Values will be normalized for comparison.
   *
   * @param {Array<NonNullable<any>>} va
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  values(va = [], policy = SchemaPolicy.APPEND) {

    if (policy === SchemaPolicy.INITIALIZE && Array.isArray(this.options.values)) {
      return this;
    }
    if (policy === SchemaPolicy.OVERWRITE || !Array.isArray(this.options.values)) {
      this.options.values = [];
    }
    if (!Array.isArray(va)) {
      va = [va];
    }
    if (policy === SchemaPolicy.PREPEND) {
      this.options.values.unshift(...va);
    }
    else {
      this.options.values.push(...va);
    }
    return this;
  }

  /**
   * The condition handler determines if the schema should be processed at all.
   * This function appends a single value processor to the handler pipeline
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema}
   */
  condition(spec) {
    return this.conditions(spec);
  }

  /**
   * The condition handler determines if the schema should be processed at all.
   * This call applies one or more value processors to the handler pipeline (default policy = append)
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  conditions(specs, policy) {
    return this.handler('conditions', specs, policy);
  }

  /**
   * The normalizer handler ensures input is in a format that the transformer can handle.
   * This call appends a single value processor to the handler pipeline.
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema}
   */
  normalizer(spec) {
    return this.normalizers(spec);
  }

  /**
   * The normalizer handler ensures input is in a format that the transformer can handle.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  normalizers(specs, policy) {
    return this.handler('normalizers', specs, policy);
  }

  /**
   * The transformer handler converts an input value into the output value used in the final configuration.
   * This call appends a single value processor to the handler pipeline.
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema}
   */
  transformer(spec) {
    return this.transformers(spec);
  }

  /**
   * The transformer handler converts an input value into the output value used in the final configuration.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  transformers(specs, policy) {
    return this.handler('transformers', specs, policy);
  }

  /**
   * The validator handler ensures an input value matches the schema, and returns a (potentially enhanced) fully validated output value.
   * This call appends a single value processor to the handler pipeline.
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema}
   */
  validator(spec) {
    return this.validators(spec);
  }

  /**
   * The validator handler ensures an input value matches the schema, and returns a (potentially enhanced) fully validated output value.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  validators(specs, policy) {
    return this.handler('validators', specs, policy);
  }

  /**
   * The serialize handler restores a configuration value to its pre-transform normalized form.
   * This call appends a single value processor to the handler pipeline.
   *
   * @param {ValueProcessorSpec} spec
   * @returns {Schema}
   */
  serializer(spec) {
    return this.serializers(spec);
  }

  /**
   * The serialize handler restores a configuration value to its pre-transform normalized form.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ValueProcessorSpec>} specs
   * @param {symbol} [policy]
   * @returns {Schema}
   */
  serializers(specs, policy) {
    return this.handler('serializers', specs, policy);
  }


  /**
   * Use another schema to extend the current one without overwriting.
   *
   * @param {ISchema|SchemaData} otherSchema - source schema
   * @param {Map<any,any>} [seen]
   * @returns {Schema} - returns self
   */
  extend(otherSchema, seen = new Map()) {
    if (typeof otherSchema !== 'object') {
      throw new SchemaError(`Invalid schema to extend`)
    }

    // Set base if not already set
    if (!this.base && otherSchema.base) {
      this.base = otherSchema.base;
    }

    this.addProperties(Object.fromEntries(
      Object.entries(otherSchema.properties ?? {})
            .map(([propertyName, propertySchema]) => [propertyName, Schema.createFromModel(propertySchema, seen)])));
    this.addUnionSchemas(Object.fromEntries(
      Object.entries(otherSchema.unionSchemas ?? {})
            .map(([unionKey, unionSchema]) => [unionKey, Schema.createFromModel(unionSchema, seen)])));

    this.addOptions(otherSchema.options ?? {});
    this.addMetadata(otherSchema.metadata ?? {});
    this.addHandlers(otherSchema.handlers ?? {});  // todo - this behaves differently than compilation!?

    return this;
  }

  /**
   * Make a copy of this schema
   *
   * @returns {Schema}
   */
  clone() {
    return Schema.createFromModel(this);
  }

  /**
   * Create a new Schema from something schema-shaped
   *
   * @param {ISchema|SchemaData|string} model
   * @param {Map<any,any>} [seen]
   * @returns {Schema}
   */
  static createFromModel(model, seen = new Map()) {
    if (typeof model === 'string') {
      return new Schema(model);
    }

    if (seen.has(model)) {
      return seen.get(model);
    }

    const schema = new Schema();
    seen.set(model, schema);

    if (model.base) {
      schema.base = model.base;
    }
    return schema.extend(model, seen);
  }
  /**
   * Static schema factory (useful for aliasing to reduce typing!)
   *
   * Prefer using fluent setters over passing options/metadata to this call
   *
   * @param {string|ISchema|SchemaData|Schema|CompiledSchema} [base] - schema
   * @param {object} [options] - schema options
   * @param {ISchemaMetadata} [metadata] - schema metadata
   * @returns {Schema}
   */
  static create(base, options, metadata) {
    return new Schema(base, options, metadata);
  }

  /**
   * Static schema factory for special schemas that ignore assignments and produce a single defined value
   *
   * Prefer using fluent setters over passing options/metadata to this call
   *
   * @param {any} literalValue - the value this schema will always emit
   * @param {object} [options] - additional options
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
          // Verify that the schema wasn't mangled into something weird
          if (hookSchema.options.values?.length !== 1) {
            throw new SchemaError(`Literal schema needs one value defined`);
          }
          if (hookSchema.hasChildren) {
            throw new SchemaError(`Literal schema should not have child properties`)
          }
          if (hookSchema.isUnion) {
            throw new SchemaError(`Literal schema should not be a union`)
          }
        }
      })
      // Important note: we do *not* return the literal during normalization
      // because hoisting union discriminators wants a compatible normalizer.
      // The values option prevents assignment if the normalized input does not
      // match the required literal value.
      .transformer(() => literalValue)

    if (options) {
      schema._setAttributes(options);
    }
    if (metadata) {
      schema.addMetadata(metadata);
    }

    return schema;
  }

  /**
   * Static schema factory for creating a schema that inherits its value from the first parent with the property name.
   * If no property name is provided, the inherit schema's property name is used, so it will look for the same name
   * higher in the schema hierarchy.
   *
   * TODO - restore compilation hook for checking whether this is a legal setup
   *
   * @returns {Schema}
   * @param {string} [propertyName]
   * @internal
   */
  static inherit(propertyName) {

    return new Schema()
      .option('reference', true)
      .transformer(/** @type {ValueProcessorFunction} */ (_value, config, location) => {
        const name = propertyName ?? location.name;
        if (location.parent === undefined) {
          throw new SchemaError('A top-level schema cannot have an inherited value');
        }
        let ancestorLocation = location.parent?.parent;

        while (ancestorLocation !== undefined) {
          const candidate = ancestorLocation.relative(name);

          if (candidate !== undefined) {
            return deepValue(config, candidate.path);
          }
          ancestorLocation = ancestorLocation.parent;
        }
        throw new SchemaError(`Inherited property "${name}" not found in any ancestor of "${location}"`);

      })

      .serializer(() => undefined)
      .default(/** @type {ValueProcessorFunction} */ (_value, config, location) => {
        // todo - check for dynamic=false during compilation!
        return propertyName ?? location.name;
      })
      .meta('omitFromSerialize')
      .meta('internal')
  }

  /**
   * Static schema factory for creating a schema that gets its value from another location based on a path.
   *
   * TODO - restore compilation hook for checking whether the provided path is known
   *
   * @param {string} path
   * @returns {Schema}
   * @internal
   */
  static reference(path) {
    return new Schema()
      .option('reference', true)
      .default(path)
      .normalizer((_, config, location) => {
        // I think this acts as if the input value is a path (based on the default below)

        // todo - maybe defer this until transform, and make it opaque?
        const referenceSchema = location.absolute(path)?.schema;
        if (referenceSchema === undefined) {
          throw new SchemaError(`Reference path ${path} not found`);
        }
        return deepValue(config, path);
      })
      .validator(/** @type {ValueProcessorFunction} */ (value, config, location) => {

        const referenceSchema = location.absolute(path)?.schema;
        if (referenceSchema === undefined) {
          throw new ValidationError(`Reference path ${path} not found`);
        }
        const configValue = deepValue(config, path);

        // If identical, we're done.
        if (configValue === value) {
          return value;
        }

        // simple values and opaque values must have an identical reference
        if (!referenceSchema?.hasChildren || referenceSchema.isOpaque) {
          throw new ValidationError(`Reference is not exactly the same as ${path}`)
        }

        // this feels wrong, but there's no guarantee a container wasn't rebuilt during validation
        return value;

      })
      .serializer(() => undefined)
      .meta('omitFromSerialize')
      .meta('internal')
  }

  // FIXME - random WIP stuff below, finish or remove:
  static self() {
    return new Schema().meta('internal').meta('$SELF')
  }

  static instanceOf(clazz) {

  }
}

/**
 * Policies for fine-grained control of composite schema internals
 * @readonly
 * @enum {symbol}
 */
export const SchemaPolicy = Object.freeze({
  INITIALIZE: Symbol('INITIALIZE'),   // only set if not already set
  OVERWRITE: Symbol('OVERWRITE'),     // overwrite
  APPEND: Symbol('APPEND'),           // add values to the end
  PREPEND: Symbol('PREPEND')          // add values to the beginning
});

