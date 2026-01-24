import { ConfiguratorError, SchemaError, ValidationError } from '../errors.js';
import { toData } from './helpers/to-data.js';
import { CompiledSchema } from './compiled-schema.js';
import { deepEquals, deepValue } from '../utils.js';
import { fpm } from './helpers/fpm.js';
import { SchemaLocation } from './schema-location.js';

/** @import { ISchemaProperties, ISchemaMetadata, ISchemaOptions, SchemaValueProcessor, SchemaData, ISchema, ProcessorSpec, AsyncSchemaValueProcessor } from './types.js' */

/** @typedef {ISchemaOptions} SchemaOptions */
/** @typedef {ISchemaMetadata} SchemaMetadata */
// This is stupid, but my IDE keeps preferring a global Schema reference over the local one:
/** @typedef {Object.<string, import("./types.js").ISchema>} SchemaProperties */
/** @typedef {Object.<string, import("./types.js").ISchema>} SchemaUnionSchemas */

/** @typedef {Object} SchemaHandlers
 * @property {Array<ProcessorSpec>} [normalizers]
 * @property {Array<ProcessorSpec>} [transformers]
 * @property {Array<ProcessorSpec>} [validators]
 * @property {Array<ProcessorSpec>} [serializers]
 * @property {Array<ProcessorSpec>} [conditions]
 * @property {Array<ProcessorSpec>} [discriminators]
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
   * Construct a Schema.
   *
   * Pass a string name of a registered schema to resolve as the base, or pass a schema-shaped object to extend.
   *
   * Prefer the fluent setters over passing in options/metadata or attributes.
   *
   * @param {string|ISchema|SchemaData} [base] - schema type or base to extend
   * @param {Object} [options] - schema options (also supports "attribute" shorthand syntax, but prefer being explicit)
   * @param {ISchemaMetadata} [metadata] - schema metadata
   */
  constructor(base, options, metadata) {

    /**
     * @type {string|undefined}
     * @internal
     */
    this._base = undefined;

    /**
     * @type {SchemaProperties}
     * @internal
     */
    this._properties = {};

    /**
     * @type {SchemaHandlers}
     * @internal
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
      this._base = base;
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
        this._base = base.base;
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
   * Parent schema, if this schema has been added as a property
   *
   * @type {Schema|undefined}
   */
  get parent() {
   throw new Error('FIXME');
  }

  /**
   * Property name of this schema within its parent
   *
   * @type {string|undefined}
   */
  get name() {
    throw new Error('FIXME')
  }

  /**
   * Name of a schema registered in SchemaResolver that this schema extends
   *
   * @type {string|undefined}
   */
  get base() {
    return this._base;
  }
  set base(base) {
    this._base = base;
  }

  /**
   * Computed path of this schema within the entire schema hierarchy
   *
   * (The root schema path is the empty string.)
   *
   * @type {string}
   */
  get path() {
    throw new Error('FIXME');
    /*
    if (!this.name) {
      return '';  // this is an unattached schema, no path.
    }
    const parent = this.parent;
    return parent?.path ? `${parent.path}.${this.name}` : `${this.name}`;

     */
  }

  /**
   * Properties are named child schemas.
   *
   * Use the property setter rather than direct access to ensure data consistency.
   *
   * @type {SchemaProperties}
   */
  get properties() {
    return this._properties;   // overridden just for type narrowing
  }

  /**
   * Handlers are grouped lists of value processors.
   *
   * Assign using the individual value processor setters.
   *
   * @type {SchemaHandlers}
   */
  get handlers() {
    return this._handlers;
  }

  /**
   * Options are settings that define how the schema behaves.
   *
   * @returns {SchemaOptions}
   */
  get options() {
    return this._options;
  }

  /**
   * Metadata defines settings that describe how the schema should interact with users.
   *
   * @type {SchemaMetadata}
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * Unions are sets of alternative schemas; a discriminator selects which to use.
   *
   * @type {SchemaUnionSchemas}
   */
  get unionSchemas() {
    return this._unionSchemas; // overridden just for type narrowing
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
    else if (Object.getPrototypeOf(this)?.hasOwnProperty(attributeName)) {
      if (!(typeof this[attributeName] === 'function')) {
        throw new Error('Unknown attribute!')
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
   * Attach a named child schema
   *
   * @param {string} propertyName - property name
   * @param {Schema|CompiledSchema|undefined} propertySchema - schema to associate with the property, undefined to delete current
   * @returns {Schema} - returns self for fluent chaining
   */
  property(propertyName, propertySchema) {
    if (typeof propertyName !== 'string') {
      throw new SchemaError('Properties must be associated with a valid name');
    }
    if (propertySchema instanceof CompiledSchema) {
      // FIXME - this should be legal with the new approach, maybe?
//      throw new SchemaError(`Unable to set property ${propertyName} to a compiled schema`);
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
    if (propertySchema === this) {
      // FIXME - maybe ok?
//      throw new SchemaError('Cannot add self as a child schema');
    }
    this.properties[propertyName] = propertySchema;

    if (this.base === undefined && this.options.type === undefined) {
      this._base = Number.isInteger(propertyName)? 'array' : 'object';
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
      delete this._options[option];
    }
    else {
      this._options[option] = value;
    }
    return this;
  }

  /**
   * Bulk add options
   *
   * @param {Object} options
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
      if (policy === SchemaPolicy.OVERWRITE || this._options[key] === undefined) {
        this.option(key, value);
      }
    }
    return this;
  }

  /**
   * Helper function for the fluent handler api calls
   *
   * @param {string} handlerName
   * @param {Array<ProcessorSpec>} specs
   * @param {symbol} [policy]
   * @private
   */
  handler(handlerName, specs = [], policy = SchemaPolicy.APPEND) {
    if (typeof handlerName !== 'string') {
      throw new SchemaError('Handlers must be associated with a valid key');
    }
    if (!Object.values(SchemaPolicy).includes(policy)) {
      throw new SchemaError('Unknown policy');
    }
    if (specs === null || specs === undefined) {
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

    const processorDefinitions = specs.map(spec => {
      if (typeof spec === 'object' && spec.processor) {
        return {...spec, spec};
      }
      else {
        return {spec}
      }
    });

    if (policy === SchemaPolicy.OVERWRITE || policy === SchemaPolicy.INITIALIZE) {
      this.handlers[handlerName] = processorDefinitions;
      return this;
    }
    if (!Array.isArray(this.handlers[handlerName])) {
      this.handlers[handlerName] = [];
    }
    if (policy === SchemaPolicy.PREPEND) {
      this.handlers[handlerName].unshift(...processorDefinitions);
    }
    else {
      this.handlers[handlerName].push(...processorDefinitions);
    }
    return this;
  }

  /**
   * Bulk add handlers
   *
   * @param {Object} handlers
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
   * @param {symbol} [policy]
   * @returns {Schema}
   * @internal
   */
  addMetadata(metadata, policy = SchemaPolicy.INITIALIZE) {
    if (typeof metadata !== 'object') {
      throw new SchemaError('Invalid metadata definition');
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (policy === SchemaPolicy.OVERWRITE || this._metadata[key] === undefined) {
        this.meta(key, value);
      }
    }
    return this;
  }

  /**
   * The discriminator handler returns the key or schema of the union member that should be used
   * This function appends a single value processor to the handler pipeline.
   *
   * @param {ProcessorSpec} spec
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
   * @param {Array<ProcessorSpec>} specs
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

    if ((this.base === undefined/* || this.base === 'any'*/) && Object.keys(unionSchema.properties).length > 0) {
      this.base = (unionSchema.properties['*'] || unionSchema.properties['0']) ? 'array' : 'object';
    }

    this._unionSchemas[key] = unionSchema;

    return this;
  }

  /**
   * Bulk-add union schemas
   *
   * @param {Object.<string,Schema>} unionSchemas
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
      if (policy === SchemaPolicy.OVERWRITE || this._unionSchemas[key] === undefined) {
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

    this.condition(async (_, target, location) => {
      if (!location.schema.isSelection) {
        throw new SchemaError(fpm(`Conditional expected a selection schema!`, location.path));
      }

      const selectionValue = (this.options.selection === true)? location.name : this.options.selection;

      const selectorLocation = await location.parent?.findPropertyLocation(pl => pl.schema.isSelector)

      if (selectorLocation) {
        const ss = selectorLocation.schema;
        const selectorValue = deepValue(target, selectorLocation.path);
        return (await ss._normalizeValue(selectorValue, target, selectorLocation) === (await ss._normalizeValue(selectionValue, target, selectorLocation)));
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
   * @param {NonNullable<any>|SchemaValueProcessor<any>} value
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
   * @param {boolean} [value];
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
   * @param {ProcessorSpec} spec
   * @returns {Schema}
   */
  condition(spec) {
    return this.conditions(spec);
  }

  /**
   * The condition handler determines if the schema should be processed at all.
   * This call applies one or more value processors to the handler pipeline (default policy = append)
   *
   * @param {Array<ProcessorSpec>} specs
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
   * @param {ProcessorSpec} spec
   * @returns {Schema}
   */
  normalizer(spec) {
    return this.normalizers(spec);
  }

  /**
   * The normalizer handler ensures input is in a format that the transformer can handle.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ProcessorSpec>} specs
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
   * @param {ProcessorSpec} spec
   * @returns {Schema}
   */
  transformer(spec) {
    return this.transformers(spec);
  }

  /**
   * The transformer handler converts an input value into the output value used in the final configuration.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ProcessorSpec>} specs
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
   * @param {ProcessorSpec} spec
   * @returns {Schema}
   */
  validator(spec) {
    return this.validators(spec);
  }

  /**
   * The validator handler ensures an input value matches the schema, and returns a (potentially enhanced) fully validated output value.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ProcessorSpec>} specs
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
   * @param {ProcessorSpec} spec
   * @returns {Schema}
   */
  serializer(spec) {
    return this.serializers(spec);
  }

  /**
   * The serialize handler restores a configuration value to its pre-transform normalized form.
   * This call applies one or more value processors to the handler pipeline.
   *
   * @param {Array<ProcessorSpec>} specs
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
   * @returns {Schema} - returns self
   */
  extend(otherSchema) {
    if (typeof otherSchema !== 'object') {
      throw new SchemaError(`Invalid schema to extend`)
    }

    // Set base if not already set
    if (!this.base && otherSchema.base) {
      this._base = otherSchema.base;
    }

    this.addProperties(Object.fromEntries(
      Object.entries(otherSchema.properties ?? {})
            .map(([propertyName, propertySchema]) => [propertyName, Schema.createFromModel(propertySchema)])));
    this.addUnionSchemas(Object.fromEntries(
      Object.entries(otherSchema.unionSchemas ?? {})
            .map(([unionKey, unionSchema]) => [unionKey, Schema.createFromModel(unionSchema)])));

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
   * @returns {Schema}
   */
  static createFromModel(model) {
    if (typeof model === 'string') {
      return new Schema(model);
    }

    const schema = new Schema();

    if (model.base) {
      schema._base = model.base;
    }
    return schema.extend(model);
  }
  /**
   * Static schema factory (useful for aliasing to reduce typing!)
   *
   * Prefer using fluent setters over passing options/metadata to this call
   *
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
   *
   * Prefer using fluent setters over passing options/metadata to this call
   *
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
      .transformer(() => literalValue)

// I think we can trust the values check for validation...
//      .validator((/** @type {any} */ value, _, /** @type {CompiledSchema} */ schema, /** @type {string} */ path) => {
//        if (value !== literalValue) {
//          throw new ValidationError(fpm(`Expected literal ${JSON.stringify(literalValue)}`, path));
//        }
//        return literalValue;
//      });


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
   * @returns {Schema}
   * @param {string} [propertyName]
   * @internal
   */
  static inherit(propertyName) {

    return new Schema()
      .normalizer(/** @type {SchemaValueProcessor<any>} */ (_value, config, location) => {
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
      .default(/** @type {SchemaValueProcessor<any>} */ (_value, config, location) => {
        return propertyName ?? location.name;
      })
      .meta('omitFromSerialize')
      .meta('internal')
  }

  /**
   * Static schema factory for creating a schema that gets its value from another location based on a path.
   *
   * @param {string} path
   * @returns {Schema}
   * @internal
   */
  static reference(path) {
    return new Schema()
      .normalizer((_, config, location) => {
        const referenceSchema = location.absolute(path)?.schema;
        if (referenceSchema === undefined) {
          throw new SchemaError(`Reference path ${path} not found`);
        }
        return deepValue(config, path);
      })
      .validator(/** @type {SchemaValueProcessor<any>} */ (value, config, location) => {

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
      .default(() => {
        return path;
      })
      .meta('omitFromSerialize')
      .meta('internal')
  }

  static self() {
    return new Schema().meta('internal').meta('$SELF')
  }
}

/**
 * Policies for fine-grained control of composite schema internals
 * @readonly
 * @enum {Symbol}
 */
export const SchemaPolicy = Object.freeze({
  INITIALIZE: Symbol('INITIALIZE'),   // only set if not already set
  OVERWRITE: Symbol('OVERWRITE'),     // overwrite
  APPEND: Symbol('APPEND'),           // add values to the end
  PREPEND: Symbol('PREPEND')          // add values to the beginning
});

