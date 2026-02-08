import {
  NormalizeError, ProcessorError,
  SchemaError,
  SerializeError,
  TransformError,
  UnionResolutionError,
  ValidationError
} from '../errors.js';
import { behead, deepEquals, deepPrune, isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { SchemaLocation } from './schema-location.js';
import {
  TraversalContext,
  processingHooks,
  preloadHooks,
  serializationHooks,
  normalizationHooks,
  transformationHooks,
  validationHooks,
  TraversalHooks,
  TraversalControl,
  postProcessValidationHooks
} from './traversal/index.js';


/** @import { TraversalContextOptions } from './traversal/traversal-context.js' */
/** @import { ISchema, ISchemaOptions, ISchemaMetadata, SchemaData, TraversalOptions, CompiledValueProcessorDefinition, ValidateOptions, SerializeOptions, ProcessOptions } from './types.js' */

/** @typedef {ISchemaMetadata} CompiledSchemaMetadata */
/** @typedef {ISchemaOptions} CompiledSchemaOptions */

/** @typedef {Object} CompiledSchemaHandlers
 * @property {Array<CompiledValueProcessorDefinition>} [normalizers]
 * @property {Array<CompiledValueProcessorDefinition>} [conditions]
 * @property {Array<CompiledValueProcessorDefinition>} [transformers]
 * @property {Array<CompiledValueProcessorDefinition>} [validators]
 * @property {Array<CompiledValueProcessorDefinition>} [serializers]
 * @property {Array<CompiledValueProcessorDefinition>} [discriminators]
 */

/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaProperties */
/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaUnionSchemas */

/**
 * CompiledSchema - the resolved version of a schema usable for processing input values into output values
 *
 * The SchemaResolver compiler takes an input Schema and constructs a CompiledSchema:
 * - The base schema hierarchy is resolved and flattened.
 * - Handlers have their input specifications converted into asynchronous processor functions.
 * - Unions may trigger property hoisting and discriminator synthesis.
 * - Core options are converted to standardized forms.
 * - Metadata is expanded by introspecting the resolved schema.
 * - Errors are thrown if the input Schema is invalid, inconsistent, or missing required data.
 *
 * @class
 * @implements ISchema
 */
export class CompiledSchema
{
  static __TOKEN = Symbol('CONSTRUCT_USING_RESOLVER')

  /** @type {Map<string,CompiledSchema>} */
  #propertiesMap = new Map();
  /** @type {CompiledSchemaProperties|undefined} */
  #properties;
  /** @type {Map<string,CompiledSchema>} */
  #unionSchemasMap = new Map();
  /** @type {CompiledSchemaUnionSchemas|undefined} */
  #unionSchemas;

  /** @type {CompiledSchemaHandlers} */
  #handlers = {};
  /** @type {CompiledSchemaOptions} */
  #options = {};
  /** @type {CompiledSchemaMetadata} */
  #metadata = {};
  /** @type {boolean} */
  #frozen = false;

  /**
   * CompiledSchema constructor - do not call directly (use SchemaResolver.compile())
   *
   * @param {Symbol} token - magic to reduce shenanigans
   */
  constructor(token) {
    if (token !== CompiledSchema.__TOKEN) {
      throw new SchemaError('CompiledSchema must be created via compilation');
    }
  }

  /**
   * Options contains information that changes schema parsing and processing.
   *
   * @type {CompiledSchemaOptions}
   */
  get options() {
    return this.#options;
  }

  /**
   * Metadata contains information for describing the schema behavior to users and hints for configuration sources.
   *
   * @type {CompiledSchemaMetadata}
   */
  get metadata() {
    return this.#metadata;
  }

  /**
   * Properties are named child schemas, defining a hierarchical schema structure.
   *
   * This is an (inefficient) cache for compatibility with the ISchema "interface".
   *
   * @type {CompiledSchemaProperties}
   */
  get properties() {
    return this.#properties ??=
      Object.freeze(Object.fromEntries(this.#propertiesMap));
  }

  /**
   *
   * @returns {IterableIterator<[string, CompiledSchema]>}
   */
  get propertyEntries() {
    return this.#propertiesMap.entries();
  }

  /**
   * Handlers are associated with asynchronous value processors.
   *
   * The "friendly" handler definitions from the source Schema are each compiled into asynchronous functions
   * that run as a pipeline.
   *
   * All handlers have the same async signature, receiving:
   *   1. a value to be processed by the current schema
   *   2. a reference to the top-level aggregate target being built or processed by the entire schema hierarchy
   *   3. a location defining the current schema and the traversal path to where it was encountered
   *   5. any (unmanaged / developer defined) options passed to whatever invoked the handler processing
   *
   * The compiled handlers may vary in their return types and exception handling behavior.
   *
   * @type {CompiledSchemaHandlers}
   */
  get handlers() {
    return this.#handlers;
  }

  /**
   * If this schema defines a union, return the schema member elements of the union.
   *
   * Unions use a discriminator handler to attempt to resolve to one of the unionSchema member elements
   * based on either the value being processed or the overall aggregated data.  The key of the
   * unionSchema in this collection is sometimes used as part of this process.
   *
   * Once the discriminator succeeds, the active schema switches to the resolved unionSchema.
   *
   * @type {CompiledSchemaUnionSchemas}
   */
  get unionSchemas() {
    return this.#unionSchemas ??=
      Object.freeze(Object.fromEntries(this.#unionSchemasMap));
  }

  /**
   *
   * @returns {IterableIterator<[string, CompiledSchema]>}
   */
  get unionSchemaEntries() {
    return this.#unionSchemasMap.entries();
  }

  /**
   * Extract this schema as a raw data object usable for cloning this schema.
   *
   * Note that the data may include handler functions, so it cannot be assumed to be serializable to JSON!
   *
   * @returns {SchemaData|undefined}
   */
  toData() {
    return toData(this);
  }

  /**
   * Return true if this schema has any child schemas.
   *
   * todo - several callers also check if it is a union and the unionSchemas have children; absorb that logic here?
   *
   * @type {boolean}
   */
  get hasChildren() {
    return this.#propertiesMap.size > 0;
  }

  /**
   * Return true if this schema supports wildcard properties.
   *
   * @type {boolean}
   */
  get hasWildcard() {
    return this.#propertiesMap.has('*');
  }

  /**
   * Return true if this schema defines an array.
   *
   * Arrays sometimes need special treatment; the built-in 'array' base schema sets this option.
   *
   * @type {boolean}
   */
  get isArray() {
    return this.options.type === 'array';
  }

  /**
   * Return true if this schema defines a function value.
   *
   * Functions passed to most operations are interpreted as dynamic values (called to retrieve actual value).
   * This setting overrides that behavior, and forces a passed function to be treated as a simple value.
   *
   * @type {boolean}
   */
  get isFunction() {
    return this.options.type === 'function'
  }


  /**
   * Return true if this schema defines a union.
   * Unions adopt the behavior of one of their unionSchema member elements based on a discriminator handler function.
   *
   * @type {boolean}
   */
  get isUnion() {
    return this.#unionSchemasMap.size > 0
  }

  /**
   * Return true if this schema is used to select union keys.
   *
   * (This doesn't guarantee that there is a matching discriminator on the parent that uses it!)
   * todo - convert this option into a generated normalizer that enforces union key values at runtime?
   *
   * @type {boolean}
   */
  get isUnionKey() {
    return !!this.options.unionKey;
  }

  /**
   * Return true if the schema acts as a selector.
   *
   * Selectors control the activation or deactivation of peer selection schemas using a conditional handler
   * synthesized during compilation.
   *
   * @type {boolean}
   */
  get isSelector() {
    return !!this.options.selector;
  }

  /**
   * Return true if this schema contains a selector as a child.
   * @type {boolean}
   */
  get hasChildSelector() {
    for (const propertySchema of this.#propertiesMap.values()) {
      if (propertySchema.isSelector) {
        return true;
      }
    }
    return false;
  }

  /**
   * Return true if this schema is a selection conditionally activated by a peer selector.
   *
   * @type {boolean}
   */
  get isSelection() {
    return this.options.selection !== undefined && this.options.selection !== false;  // todo - use a symbol to trigger name rather than "true"...
  }

  /**
   * Return true if this schema contains a selection as a child.
   * @type {boolean}
   */
  get hasChildSelection() {
    for (const propertySchema of this.#propertiesMap.values()) {
      if (propertySchema.isSelection) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the selector value that triggers this selection.  The default value for a selection is its own property name.
   *
   * @type {string|boolean|undefined}
   */
  get selection() {
    return this.options.selection;
  }

  /**
   * Return the legal (normalized) values this schema accepts, if defined.
   *
   * (This acts as an "upstream" check before calling any transform handlers.)
   *
   * @type {Array<NonNullable<any>>|undefined}
   */
  get values() {
    return this.options.values;
  }

  /**
   * Returns true if this schema defines any values it accepts.
   *
   * @type {boolean}
   */
  get hasValues() {
    const v = this.options.values;
    return Array.isArray(v) && v.length > 0;
  }

  /**
   * Returns whether this schema enforces strict/lax checking.
   *
   * - returns true if the schema uses strict checking
   * - returns false if the schema uses lax checking
   * - if undefined, it depends on the traversal context and the behavior of individual processors
   *
   * This setting is useful for preventing validation errors when transforms return new objects
   * that contain extra properties that don't match the schema.
   *
   * In most contexts (e.g. assignment processing and validation) strict processing is the default.
   * Setting lax mode changes several behaviors:
   * - If a union is marked lax, it is not an error to fail to resolve the union
   * - If a leaf schema is marked lax, it is not an error if a value fails to assign to it
   *
   * Lax mode does *not* mean that errors during normalization
   *
   * @type {boolean|undefined}
   */
  get strict() {
    return this.options.strict;
  }

  /**
   * Returns true if the value defined by this schema is required to exist in the output to be valid.
   *
   * Under the normal pathways, this is a shallow requirement:
   * - Each schema checks its own input; if the required flag is set, the input must not be undefined.
   * - If the input value is defined and the schema defines child properties, the input will be traversed
   *   and recursively checked against the child property schemas.
   * - If the input value is undefined, child property schemas are NOT checked.
   *
   * If the "deep" flag is set on the schema, this behavior changes:
   * - If the input value is undefined on a schema with "deep" set, child properties ARE checked.
   *
   * If a schema sets a default value, it will generally satisfy the required setting (unless set to a
   * value function that returns undefined!)
   *
   * @type {boolean}
   */
  get required() {
    return this.options.required ?? false;
  }

  /**
   * Returns the default value this schema provides if the input is undefined.
   *
   * This is normally interpreted as a "shallow" default;
   * - If the schema being actively processed has a default value and the input value is undefined, the default is used.
   * - If the schema being actively processed defines child properties, and is passed an input value that does not
   *   contain a value for a specific child that defines a default, the child's default will be used.
   * - If the schema being actively processed defines child properties, but is passed an undefined input value,
   *   the child property schemas will not be traversed, and thus any child defaults will not take effect.
   *
   * This last behavior changes if the "deep" schema option is set:
   * - If the schema being actively processed defines child properties is passed an undefined input value when
   *   the "deep" option is enabled, child property schemas will be traversed and any defaults will be used.
   *
   * The default may also be set to a value function:
   * `async (value: any, target: any, location:SchemaLocation, options: Object): any`
   * that will be called during the normalization phase.  This can be useful for late binding, remote lookups,
   * side effects, or lazy evaluation of expensive values.
   *
   * @type {any|undefined}
   */
  get default() {
    return this.options.default;
  }

  /**
   * Returns whether this schema should be deeply traversed even when the input is empty.
   *
   * This is useful for triggering required/defaults settings.  (Note that a schema with
   * child properties that is marked required is deep by default, because that's almost
   * always what is wanted/expected.)
   *
   * Returns undefined if unset, signaling that the traversal context will decide.
   *
   * @type {boolean|undefined}
   */
  get deep() {
    if (this.options.deep !== undefined) {
      return this.options.deep;
    }
    if (this.hasChildren && this.required) {
      return true;
    }
    return undefined;
  }

  /**
   * Return true if the schema always returns an inherited value.
   *
   * Inherited properties never accept a direct assignment, and will always return the value
   * corresponding to the first matching property name found higher in the schema.
   *
   * @type {boolean}
   */
  get isInherited() {
    return this.options.inherit ?? false;
  }

  /**
   * Returns true if this schema defines a value that can be assumed to always exist and be valid after transformation.
   *
   * The implicit setting implies that values passed to this schema should not be visited or validated.
   *
   * @type {boolean}
   */
  get isImplicit() {
    return this.options.implicit ?? false;
  }

  /**
   * Returns true if the container allows incremental assignment to children.
   * Deprecated - use "opaque" as a more accurate signal of intent.
   *
   * @type {boolean}
   * @deprecated
   */
  get allowIncremental() {
    return this.options.allowIncremental ?? this.hasChildren;
  }

  /**
   * Returns true if the schema defines a value whose internals are hidden after transformation.
   *
   * @type {boolean}
   */
  get isOpaque() {
    return !this.hasChildren || this.options.allowIncremental === false;
  }

  /**
   * @param {Array<CompiledValueProcessorDefinition>} processorDefinitions
   * @param {any} value - value to normalize
   * @param {any} target - top level output target being built (avoid using for normalizers!)
   * @param {SchemaLocation} location - path to this value in the output target
   * @param {Object} [options] - optional tweaks to processor behavior
   * @returns {Promise<any>}
   */
  async _executeProcessorPipeline(processorDefinitions = [], value, target, location, options) {
    if (location.schema !== this) {
      throw new SchemaError('Inconsistent schema location', {location});
    }
    for (const def of processorDefinitions) {
      if (typeof def.processor !== 'function') {
        throw new SchemaError('Processor is not a function', {location, value: def})
      }
      value = await def.processor(value, target, location, options);
      if (value === null) {
        return null;
      }
    }
    return value;
  }
  /**
   * Check if the provided value (and/or current output target) passes the schema conditional check.
   *
   * Failed conditions will be repeatedly re-checked during assignment processing until the final pass.
   * Errors encountered while checking conditions are caught and simply result in a failed condition.
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {Object} [options]
   * @returns {Promise<boolean>}
   * @internal
   */
  async _checkCondition(value, target, location = new SchemaLocation(this), options) {
    const conditions = Array.isArray(this.handlers.conditions)? this.handlers.conditions : [];

    // no conditions = pass!
    if (conditions.length === 0) {
      return true;
    }

    let checked = value;
    for (const condition of conditions) {
      try {
        checked = await condition.processor(checked, target, location, options);
      }
      catch (error) {
        return false;  // exception = failed condition check
      }
    }
    return Boolean(checked);
  }

  /**
   * Use the registered discriminator to return a matching union schema, or undefined if the union cannot be resolved.
   * Discriminator functions must return either one of the unionSchema members, a unionSchema key, or undefined.
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   * @internal
   */
  async _discriminateUnion(value, target, location = new SchemaLocation(this), options) {
    if (location.schema !== this) {
      throw new SchemaError('Inconsistent discriminator schema location', {location});
    }

    const strict = options?.strict ?? false;

    if (!this.isUnion || this.handlers.discriminators === undefined) {
      return undefined;
    }

    const discriminators = Array.isArray(this.handlers.discriminators)? this.handlers.discriminators : [];

    // we'll run multiple discriminators if necessary, but it's a bizarre use case...

    let discriminatorResult = value;
    for (const discriminator of discriminators) {
      try {
        discriminatorResult = await discriminator.processor(discriminatorResult, target, location, options);
      }
      catch (error) {
        if (strict) {
          throw error;
        }
        return undefined;
      }
    }
    if (!discriminatorResult) {
      if (strict) {
        throw new UnionResolutionError('Unable to resolve union', {location});
      }
      return undefined;
    }
    if (typeof discriminatorResult === 'string') {
      // String lookups (e.g., from property extraction) - return undefined if no match

      return this.#unionSchemasMap.get(discriminatorResult);
    }
    if (discriminatorResult instanceof CompiledSchema && this.findUnionKey(discriminatorResult)) {
      return discriminatorResult;
    }
    // Schema returned but not valid - this is a developer error
    throw new SchemaError('Union discriminator returned unexpected value', {location})
  }

  /**
   * Ensure the input is of an expected shape that can be handled by this schema.
   *
   * Runs all normalizer value processors in a pipeline until completion or an error is thrown.
   * As most external configuration will originate in the form of strings or JSON
   * structures, the main task of a normalizer is to "canonicalize" these inputs:
   * - The normalized output should be accepted by the transformer handler.
   * - Normalizers should usually pass through valid transformed values unchanged.
   * - By contract, when passed "true", a container schema should construct an "empty"
   *   container (e.g. {} or []).  (Even a schema that defines transformation to a
   *   complex class should have a normalized empty container format to use for construction).
   *
   * The normalize process will throw an exception if the input is incompatible.
   *
   * Unlike other handlers, normalizers should generally not depend on the overall
   * target configuration state, as they are sometimes invoked in isolation (even during compilation!)
   * and thus shouldn't assume the "undefined means retry later" behavior of other handlers.
   *
   * Also note that normalizeValue does not recursively examine child properties.
   *
   * @param {any} value - value to normalize
   * @param {any} [target] - top level output target being built (avoid using for normalizers!)
   * @param {SchemaLocation} [location] - path to this value in the output target
   * @param {Object} [options] - optional tweaks to normalizer behavior
   * @returns {Promise<any>}
   * @internal
   */
  async _normalizeValue(value, target, location = new SchemaLocation(this), options) {

    if (location.schema !== this) {
      throw new SchemaError('Inconsistent schema location', {location});
    }

    if (typeof value === 'function' && !isConstructor(value)) {
      if (this.options.dynamic !== false) {
        try {
          value = await value(true, target, location, options);
        }
        catch (error) {
          throw new NormalizeError('Exception calling value function', {location, cause: error});
        }
      }
    }

    if (value === null) {
      return null;
    }

    if (value === undefined) {
      if (!this.options.allowUndefined) {
        return undefined;
      }
    }

    try {
      return await this._executeProcessorPipeline(this.handlers.normalizers, value, target, location, options);
    }
    catch (error) {
      throw new NormalizeError('Unable to normalize', {value, location, cause: error});
    }
  }

  /**
   * Transform an input value for the final target based on this schema and provided context.
   *
   * Runs all transformer value processors in a pipeline until one returns undefined or throws an error.
   * - The input to the pipeline is be assumed to be normalized.
   * - An error may be thrown if the input cannot be transformed.
   * - If a transformer depends upon the overall configuration, it may return undefined to signal
   *   that the transform should be retried when the configuration is updated.
   *
   * A schema's transform is allowed to enforce validation internally, or it can delegate this to
   * the validation handler.  In any case, the output from the transform is not guaranteed to be valid.
   * (Note that conditions and unions are not checked if you call this directly.)
   *
   * Child properties are not traversed in this call, and are presumed to already have been transformed.
   *
   * @param {any} value - input value to transform
   * @param {any} [target] - global target in case the transformer depends on it
   * @param {SchemaLocation} [location] - the traversal location of the schema
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   * @internal
   */
  async _transformValue(value, target, location = new SchemaLocation(this), options) {

    if (location.schema !== this) {
      throw new SchemaError('Inconsistent transform schema location', {location});
    }

    if (this.isImplicit) {
      throw new SchemaError('Cannot transform a value for an implicit schema', {location});
    }

    if (value === null || value === undefined) {
      return value;
    }

    const strict = this.strict ?? options?.strict ?? true;

    try {
      if (! await this.accepts(value, target, location, {...options, strict})) {
        return undefined;
      }
      return await this._executeProcessorPipeline(this.handlers.transformers, value, target, location, options);
    }
    catch (error) {
      throw new TransformError('Unable to transform', {value, location, cause: error})
    }
  }

  /**
   * Validate the provided input value.
   *
   * Runs all validator value processors in a pipeline until one throws an error.
   * Validators can return a different value from the input (presumably "more valid",
   * e.g. strings trimmed, case made consistent, etc.) but must throw if the input is invalid.
   *
   * Children are not traversed in this call.
   *
   * @param {any} value - value to validate
   * @param {any} [target] - complete output target
   * @param {SchemaLocation} [location] - traversal location of this schema
   * @param {Object} [options] - options to tweak validation behavior
   * @returns {Promise<any>}
   * @internal
   */
  async _validateValue(value, target, location = new SchemaLocation(this), options) {
    if (this.required === true && value === undefined) {
      throw new ValidationError('Missing required value', {location});
    }
    if (value === null || value === undefined) {
      return value;
    }

    try {
      // validators cannot clear the value, they can only throw
      return await this._executeProcessorPipeline(this.handlers.validators, value, target, location, options) ?? value;
    }
    catch (error) {
      throw new ValidationError('Unable to validate', {value, location, cause: error});
    }
  }

  /**
   * Serialize the provided input value.
   *
   * @param {any} value - value to serialize
   * @param {any} [target] - entire output being serialized
   * @param {SchemaLocation} [location] - traversal location to current schema
   * @param {Object} [options] - options to tweak serialization behavior
   * @returns {Promise<any>}
   * @internal
   */
  async _serializeValue(value, target, location = new SchemaLocation(this), options) {

    const serializers = Array.isArray(this.handlers.serializers)? this.handlers.serializers : [];

    if (serializers.length === 0) {
      // fallback (?)
      if (this.hasChildren) {
        return this.isArray? [] : {}
      }
    }
    try {
      return await this._executeProcessorPipeline(serializers, value, target, location, options) ?? value; // validators cannot clear the value, they can only throw
    }
    catch (error) {
      if (options?.strict) {
        throw new SerializeError('Unable to serialize', {value, location, cause: error})
      }
      else {
        return undefined;
      }
    }
  }

  /**
   * Return true if this schema seems to be able to handle a given input value.
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {any} [options]
   * @returns {Promise<boolean>}
   */
  async accepts(value, target, location = new SchemaLocation(this), options) {

    const strict = options?.strict;

    if (value === undefined) {
      if (this.options.allowUndefined) {
        return true;
      }
      if (strict) {
        throw new ValidationError('Schema does not accept an undefined input', {location});
      }
      return false;
    }

    // todo - perhaps we should require that the value has been already normalized?
    /*
    let normalizedValue;
    try {
      normalizedValue = await this._normalizeValue(value, target, location, options);
      if (normalizedValue === undefined) {
        if (strict) {
          throw new NormalizeError(fpm('Schema normalization failed', location));
        }
        return false;
      }
    }
    catch (error) {
      if (strict) {
        throw error;
      }
      return false;
    }

     */
    if (!Array.isArray(this.values)) {
      return true;
    }
    const found = this.values.some(v => deepEquals(v, value));

    if (!found) {
      if (strict) {
        // todo - consider using valueDescription metadata
        throw new ValidationError(`Invalid value: «${value}», expected one of {${this.values.join('|')}}`, {location});
      }
      return false;
    }
    return true;
  }


  /**
   * Load the provided target as if it were the result of previous assignments.
   *
   * @param {any} target
   * @param {TraversalContext} context
   * @returns {Promise<any>}
   * @internal
   */
  async _preload(target, context) {

    const location = new SchemaLocation(this);

    if (!context) {
      context = new TraversalContext(location);
    }
    context._debug('PRELOAD', {target})
    return await this.traverse(target, {hooks: preloadHooks, context});
  }


  /**
   * Normalize the input value.
   *
   * Unlike _normalizeValue, this will normalize an entire object hierarchy, starting at the root.
   * Deprecated because this is weird, and under some conditions doesn't play well with the hook semantics.
   * (Normalization and transformation are phases, not independent top level operations.)
   *
   * @param {any} input - input value to normalize
   * @param {any} [target] - optional existing value
   * @param {any} [options]
   * @returns {Promise<any>} - normalized value
   * @deprecated
   * @internal
   */
  async _normalize(input, target, options) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = new TraversalContext(location, {strict: false});

    if (target !== undefined) {
      await this._preload(target, context);
    }

    const result = await this.traverseMultipass(input, {hooks: normalizationHooks, context});

    return result;
  }

  /**
   * Transform the input value.
   *
   * Unlike _transformValue, this assumes it starts at the root, and will normalize and transform an entire object hierarchy.
   * Deprecated because this is weird, and under some conditions doesn't play well with the hook semantics.
   * (Normalization and transformation are phases, not independent top level operations.)
   *
   * @param {any} input - input value to transform
   * @param {TraversalOptions} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   * @deprecated
   * @internal
   */
  async _transform(input, options) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = new TraversalContext(location, options);
    const result = await this.traverseMultipass(input, {hooks: transformationHooks, context});

    return result;
  }


  /**
   * Return a validated output if and only if the input fully matches the schema definition.
   *
   * Note: depending on the processors used for validation, the input value may be mutated during validation!
   * (todo - create an option that prevents this from happening?)
   *
   * @param {any} value - input value to validate
   * @param {ValidateOptions} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(value, options) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = new TraversalContext(location, options);
    if (value !== undefined) {
      await this._preload(value, context);
    }

    return await this.traverseMultipass(value, {hooks: validationHooks, context})
  }


  /**
   * Process input path/value assignments into an output value based on the schema.
   *
   * Paths are dotted references into the schema hierarchy.  Assignment values are normalized, transformed,
   * validated, and then used to build the output value.
   *
   * If a value for the output target is provided, it is assumed to already be valid.
   *
   * Errors are thrown if:
   * - unexpected paths are provided that don't match the schema
   * - a value is incompatible with the schema referenced by the path
   * - a value processor throws an error
   * - a value cannot be processed (value processors return undefined) after repeated attempts
   * - a union cannot be resolved
   *
   *
   * @param {Map<string,any>} assignments - path/value associations
   * @param {any} [target] - preexisting output value to build upon, if any
   * @param {ProcessOptions & TraversalOptions & TraversalContextOptions} [options] - options to customize the traversal
   * @returns {Promise<any>} - returns the output value
   */
  async processAssignments(assignments, target, options = {}) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(location, {strict: options?.strict, deep: options?.deep, debug: options?.debug});

    if (target !== undefined) {
      await this._preload(target, context);
    }
    const hooks = processingHooks;
    for (let [inputPath, input] of assignments) {
      context._debug('processing assignment', {inputPath, input})

      await this.traverse(input, {inputPath, context, hooks});
    }

    return await this.traverseMultipass(undefined, {context, hooks});
  }

  /**
   * Process an input value to an output value based on this schema.
   *
   * Errors are thrown if:
   * - the input value doesn't match the schema
   * - a value processor throws an error
   * - a value cannot be processed (value processors return undefined) after repeated attempts
   * - a union cannot be resolved
   *
   * If an output target is provided, it is assumed to already be valid.
   *
   * @param {any} input - the value to process
   * @param {any} [target] - preexisting output value to build upon, if any
   * @param {ProcessOptions & TraversalOptions & TraversalContextOptions} [options] - options to customize the traversal
   * @returns {Promise<any>} - returns the output value
   */
  async process(input, target, options = {}) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(location, {strict: options?.strict, deep: options?.deep, debug: options?.debug });
    const hooks = processingHooks;

    if (target !== undefined) {
      await this._preload(target, context);
    }

    const result = await this.traverseMultipass(input, {context, hooks});

    return await this.traverse(result, {context, hooks: postProcessValidationHooks});

    //return result;
  }



  /**
   * Serialize the config data as if you were going to use the result for a config file.
   *
   * Runs all serialization processors in a pipeline.  By default, if any processor returns undefined or throws an error,
   * serialization of that value returns undefined and will be omitted from the output.  If you set the "strict"
   * option, errors are re-thrown.
   *
   * Serializers attempt to convert resolved values back to an input-friendly value, first via the "serialize"
   * schema option, or alternatively by trusting that each value is either already compatible, or implements toJSON().
   *
   * @param {any} configuration
   * @param {SerializeOptions} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(configuration, options) {
    const location = options?.location ?? new SchemaLocation(this);

    const context = new TraversalContext(location, {strict: options?.strict ?? false});


    if (configuration !== undefined) {
      context.setValue(configuration);  // serialization uses a fixed configuration
    }

    const result = await this.traverseMultipass(configuration, {hooks: serializationHooks, context})

    // clean up any null markers or undefined keys
    return deepPrune(result);
    }

  /**
   * Given a reference to a union schema member, return the matching key, or undefined if it cannot be found.
   *
   * @param {CompiledSchema} unionSchema
   * @returns {string|undefined}
   */
  findUnionKey(unionSchema) {
    if (!this.isUnion) {
      throw new SchemaError('Cannot find union key because schema is not a union');
    }
    for (const [k, s] of this.unionSchemaEntries) {
      if (s === unionSchema) {
        return k;
      }
    }
    return undefined;
  }

  /**
   * Given a union key, retrieve the matching union schema, or undefined if it cannot be found
   *
   * @param {string} key
   * @returns {CompiledSchema|undefined}
   */
  getUnionSchema(key) {
    if (!key) {
      throw new SchemaError('Unable to retrieve an unnamed union schema key');
    }
    if (!this.isUnion) {
      throw new SchemaError(`Cannot get union schema with key "${key}" because schema is not a union`);
    }
    return this.#unionSchemasMap.get(key);
  }

  /**
   * @param {string} key
   * @param {CompiledSchema} unionSchema
   * @returns {CompiledSchema}
   * @internal
   */
  _setUnionSchema(key, unionSchema) {
    if (!key) {
      throw new SchemaError('Unable to set a union schema without a valid key');
    }
    if (!(unionSchema instanceof CompiledSchema)) {
      throw new SchemaError('Union schema must be a CompiledSchema instance');
    }
    if (this.#frozen) {
      throw new SchemaError(`Cannot add union schema "${key}" to a frozen CompiledSchema`);
    }
    // clear cache, if set
    this.#unionSchemas = undefined;

    this.#unionSchemasMap.set(key, unionSchema);

    return unionSchema;
  }


  /**
   * Find the schema at a given path, falling back to the wildcard schema if one exists.
   *
   * The root schema may be found at '', the empty string.  Array members are referenced with dotted integer indexes.
   * Note that find() does not check union members; use SchemaLocation for finding schemas resolved during traversal.
   *
   * @param {string} path
   * @returns {undefined|CompiledSchema}
   */
  find(path) {
    if (!path || path === '' || path === '.') {
      return this;
    }
    const pathComponents = path.split('.');

    /** @type {CompiledSchema|undefined} */
    let s = this;

    for (let pathComponent of pathComponents) {
      s = s?.getPropertySchema(pathComponent);

      if (!s) {
        return undefined;
      }
    }
    return s;
  }

  /**
   * toAssignments - attempt to convert input data to a map of assignments.
   *
   * @param {any} object - input
   * @param {string} prefix - prefix to add to any path generated
   * @returns {Map<string, any>} - output map of path-to-value associations
   */
  toAssignments(object, prefix = '') {
    if (typeof object !== 'object') {
      return new Map([['', object]])
    }

    const assignments = new Map();

    /**
     *
     * @param {CompiledSchema|undefined} schema
     * @param {any} current
     * @param {string} path
     */
    function walk(schema, current, path) {
      const isContainer = Array.isArray(current) || isPlainObject(current);

      const allowIncremental = schema?.allowIncremental ?? true;
      //const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (isContainer && schema?.hasChildren) {//} && allowIncremental) {
        const entries = Array.isArray(current)? current.entries() : Object.entries(current);

        for (const [key, value] of entries) {
          const propertySchema = schema?.getPropertySchema(`${key}`);
          walk(propertySchema, value, path ? `${path}.${key}` : `${key}`)
        }
      }
      else {
        assignments.set(path, current);
      }
    }
    walk(this, object, prefix);
    return assignments;
  }

  /**
   * Invoke a provided visitor function on every schema node; if visitor returns false (explicitly), abort early.
   *
   * @param {(schema:CompiledSchema, path:string) => any} visitor - visitor function
   * @param {{onlySerializable?:boolean}} [options]
   * @returns {boolean} - returns true if visitors all returned true, false if any exited early
   */
  visitSchema(visitor, options) {
    const walked = new Set();
    const onlySerializable = options?.onlySerializable ?? false;
    /**
     * @param {CompiledSchema} schema
     * @param {string} path
     * @returns {any|boolean}
     */
    function walk(schema, path) {
      if (walked.has(schema)) {
        return false;
      }
      walked.add(schema);
      if (schema.metadata.omitFromSerialize && onlySerializable) {
        return false;
      }
      if (schema.hasChildren) {
        for (const [propName, propSchema] of schema.propertyEntries) {
          const childPath = path ? `${path}.${propName}` : `${propName}`;
          if (walk(propSchema, childPath) === false) {
            return false;
          }
        }
      }
      if (schema.isUnion) {
        for (const [unionSchemaKey, unionSchema] of schema.unionSchemaEntries) {
          if (walk(unionSchema, path) === false) {
            return false;
          }
        }
      }
      return visitor(schema, path);
    }
    return walk(this, '') ?? true;
  }


  /**
   * Traverse the provided input data based on the current schema.
   *
   * Behaviors are composed via "hooks" that are called at pre/post phases during the traversal.
   * This is all rather complex, so it's kept as an internal detail and is not part of the public API surface.
   *
   * @param {any} input
   * @param {TraversalOptions} [options]
   * @returns {Promise<any>}
   * @internal
   */
  async traverse(input, options) {

    const context = options?.context ?? new TraversalContext(new SchemaLocation(this)).finalize();
    const hooks = options?.hooks ?? new TraversalHooks();

    const path = options?.path ?? '';
    const inputPath = options?.inputPath ?? '';  // the relative path from this schema to the input
    const isInputPath = (inputPath === '');
    context._debug('traverse: starts', {path, inputPath})

    const target = options?.target;
    if (path === '' && target !== undefined) {
      await this._preload(target, context);
    }
    const strict = this.strict ?? options?.strict ?? true;

    const state = context.getState(path);

    const initialize = async() => {
//      context._debug('traverse: initialize', {path, inputPath})

      if (state.schema === undefined) {
        state.schema = this;
      }

      if (isInputPath) {
        if (input !== undefined) {
          state.assignedInput = input;
        }
        if (state.assignedInput === null) {
          state.value = null;
        }
        else if (state.assignedInput !== undefined) {
          if (true || state.treatAsExplicit) {
            state.isMandatory = true;
          }
        }
      } else {
        const inputState = state.relative(inputPath);

        if (input !== undefined && inputState.assignedInput !== input) {
          inputState.assignedInput = input;
        }
        if (state.assignedInput === undefined) {
//          state.assignedInput = true;
        }
      }
      return TraversalControl.OK;
    }
    const startCurrent = async () => {
//      context._debug('traverse: startCurrent', {path, inputPath})
      return await hooks.startCurrent(state);
    }

    // todo - merge deepProperty / handleProperties?

    const deepProperty = async() => {
      if (!this.hasChildren || isInputPath) {
        return TraversalControl.OK;
      }
//      context._debug('traverse: deepProperty', {path, inputPath})

      const [propertyKey, propertyInputPath] = behead(inputPath);
      const propertyState = state.relative(propertyKey);

      if (!propertyState) {
        return TraversalControl.OK;
      }
      const startResult = await hooks.startProperty(state, propertyState);

      if (startResult !== TraversalControl.OK) {
        return TraversalControl.OK;
      }
      await propertyState.schema?.traverse(input, {context, hooks, path: propertyState.path, inputPath: propertyInputPath});
      if (propertyState.value !== undefined && state.pending === undefined && state.value === undefined) {
        // lazy container creation - todo - move into endProperty by passing hooks in?
        state.isMandatory = true;
        if (state.assignedInput === undefined) {
          state.assignedInput = true;
        }

        await hooks.startCurrent(state);  // todo - check errors/result
      }
      await hooks.endProperty(state, propertyState);
    }

    const handleProperties = async() => {
      if (!this.hasChildren || !isInputPath) {
        return TraversalControl.OK;
      }
//      context._debug('traverse: handleProperties', {path, inputPath})

      async function handlePropertyStart(propertyState) {
        const startResult = await hooks.startProperty(state, propertyState);

        if (startResult !== TraversalControl.OK) {
          return false;
        }

        const propertyOptions = {
          context,
          hooks,
          path: propertyState.path
        }

        if (propertyState.schema !== undefined) { // input is set via the start property hook!
          await propertyState.schema.traverse(undefined, propertyOptions);
        }
        return propertyState.value !== undefined && propertyState.value !== null;  // return true if the property has a value
      }
      const propertyStates = state.getActivePropertyStates();

      // FIXME - reenable when done debugging:
      // Process properties in parallel:
      const hasPropertyValue = (await Promise.all(propertyStates.map(propertyState => handlePropertyStart(propertyState)))).some(Boolean);

      //let hasPropertyValue = false;
      //for (const propertyState of propertyStates) {
      //  const result = await handlePropertyStart(propertyState);

      //  hasPropertyValue ||= Boolean(result);
      //}


      if (state.pending === undefined && state.value === undefined && hasPropertyValue) {
        // Lazy-create container if any child property has a value
        state.isMandatory = true;
        if (state.assignedInput === undefined) {
          state.assignedInput = true; // this will get normalized to the appropriate container type
        }
        await hooks.startCurrent(state);  // todo - check errors?
      }
      // FIXME - reenable when done debugging
      await Promise.all(propertyStates.map(propertyState => hooks.endProperty(state, propertyState)))

      //for (const propertyState of propertyStates) {
      //  await hooks.endProperty(state, propertyState);
      //}

      return TraversalControl.OK;
    }
    const endCurrent = async () => {
//      context._debug('traverse: endCurrent', {path, inputPath})

      return await hooks.endCurrent(state);
    }

    for (const phase of [initialize, startCurrent, isInputPath? handleProperties : deepProperty, endCurrent]) {
//      context._debug('traverse: phase', {path, inputPath, phase: phase.name})

      const result = await phase() ?? TraversalControl.OK;
      if (state.schema !== this) {
        return await state.schema?.traverse(input, options);
      }
      if (result !== TraversalControl.OK || state.value === null) {
//        context._debug('traverse: post-phase break', {path, inputPath, phase: phase.name})

        break;
      }
    }
//    context._debug('traverse: returns', {path, inputPath, value: state.value})

    if (state.value !== undefined && state.path === '') {
      state.isProcessed = true;  // root needs to mark itself as processed
    }
    return state.value;
  }

  /**
   * Repeatedly traverse the provided input data based on the current schema until it stabilizes (or an error occurs)
   *
   * See traverse() for more details.
   *
   * @param {any} input
   * @param {Object} [options]
   * @returns {Promise<any>}
   * @internal
   */
  async traverseMultipass(input, options) {
    let done = false;
    let result = undefined;

    const context = options?.context ?? new TraversalContext(new SchemaLocation(this));
    const path = options?.path ?? '';

    // ensure the root state exists so that the context doesn't already appear to be completed on the first pass
    context.getState(path);

    // loop until context stabilizes
    while (!done) {
      let counter = context.counter;
      context._debug(`****** MULTIPASS TRAVERSAL ${context.traversals} STARTS ******`)

      result = await this.traverse(input, options);

      if (context.counter === counter || context.isComplete) {
        // nothing changed during this traversal pass, or we've handled all known assignments
        if (context.final) {
          done = true;
        }
        else {
          // attempt finalization pass (may discover defaults, newly resolved unions/conditions, etc.)
          context.final = true;
        }
      }
      else {
        // if we were finalizing and something changed, allow another pass
        // (footgun warning: interdependent unions or conditions could result in nondeterministic resolution!)
        context.final = false;
      }
      context.traversals++;
    }
    return result;
  }

  /**
   * Compute all possible schema paths (including union schema properties)
   *
   * @returns {Set<string>}
   */
  getPropertyPaths() {
    const propertyPaths = new Set();

    this.visitSchema((_schema, path) => {
      if (path) {
        propertyPaths.add(path);
      }
    })
    return propertyPaths;
  }

  /**
   * Return a named property schema (possibly via wildcard)
   *
   * @param {string} propertyName
   * @returns {CompiledSchema|undefined}
   */
  getPropertySchema(propertyName) {
    if (!propertyName) {
      throw new SchemaError('Unable to retrieve an unnamed property');
    }
    return this.#propertiesMap.get(propertyName) ?? this.#propertiesMap.get('*');
  }

  /**
   * Associate a schema with a property name.  Only for use during compilation.
   *
   * @param {string} propertyName
   * @param {CompiledSchema} propertySchema
   *
   * @internal
   */
  _setPropertySchema(propertyName, propertySchema) {
    if (!propertyName) {
      throw new SchemaError('Unable to set an unnamed property');
    }
    if (!(propertySchema instanceof CompiledSchema)) {
      throw new SchemaError('Property schema must be a CompiledSchema instance');
    }
    if (this.#frozen) {
      throw new SchemaError(`Cannot add property ${propertyName} to a frozen CompiledSchema`);
    }
    // clear cache, if set
    this.#properties = undefined;

    this.#propertiesMap.set(propertyName, propertySchema);

    return propertySchema;
  }

  /**
   * Return all child schemas that have a particular option tag
   *
   * @param {string} tag
   * @returns {CompiledSchema[]}
   * @deprecated
   */
  getTagged(tag) {
    const schemas = [];
    for (const propSchema of this.#propertiesMap.values()) {
      if (propSchema.options[tag]) {
        schemas.push(propSchema);
      }
    }
    return schemas;
  }

  /**
   * Get the first child schema that has a particular option tag
   *
   * @param {string} tag
   * @returns {CompiledSchema|undefined}
   * @deprecated
   */
  getFirstTagged(tag) {
    for (const propSchema of this.#propertiesMap.values()) {
      if (propSchema.options[tag]) {
        return propSchema;
      }
    }
    return undefined;
  }

  /**
   * Return true if the path is legal within the schema (including all union schemas)
   *
   * @param {string} path
   * @returns {boolean}
   */
  isValidPath(path) {
    if (path === '') {
      return true;  // means the current schema!
    }
    const parts = path.split('.');

    /**
     * @param {CompiledSchema} schema
     * @param {number} index
     * @returns {boolean}
     */
    function check(schema, index = 0) {
      if (index >= parts.length) {
        return schema !== undefined;
      }
      const propertyName = parts[index];

      const propertySchema = schema.getPropertySchema(propertyName);
      if (propertySchema) {
        return check(propertySchema, index + 1);
      }
      else if (schema.isUnion) {
        for (const unionSchema of schema.#unionSchemasMap.values()) {
          if (check(unionSchema, index)) {
            return true;
          }
        }
      }
      return false;
    }
    return check(this);
  }

  /**
   * Write-protect this schema at the end of compilation.
   *
   * @internal
   */
  _freeze(seen = new Set()) {
    if (this.#frozen || seen.has(this)) {
      return;
    }
    seen.add(this);
    for (const childSchema of this.#propertiesMap.values()) {
      childSchema._freeze(seen);
    }
    Object.freeze(this.#propertiesMap);
    for (const unionSchema of this.#unionSchemasMap.values()) {
      unionSchema._freeze(seen);
    }
    Object.freeze(this.#unionSchemasMap);
    Object.freeze(this.#options);
    Object.freeze(this.#metadata);
    Object.freeze(this);
  }
}


