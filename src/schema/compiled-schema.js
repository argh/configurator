import { behead, deepEquals, deepPrune, isPlainObject, isTruthy } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { SchemaLocation } from './schema-location.js';
import {
  TraversalContext,
  TraversalState
} from './traversal/index.js';

// Core executor functionality

import { ValueProcessor } from './value-processor/value-processor.js';

// Traversal executor functionality
import { TraversalStateExecutor } from "./traversal/executors/traversal-state-executor.js";

import {
  NormalizeError, SchemaError,
  SerializeError,
  TransformError,
  ValidationError
} from './schema-errors.js';
import {
  PRELOAD_ENTER, PRELOAD_EXIT,
  PROCESS_ENTER, PROCESS_EXIT,
  NORMALIZE_ENTER, NORMALIZE_EXIT,
  TRANSFORM_ENTER, TRANSFORM_EXIT,
  VALIDATE_ENTER, VALIDATE_EXIT,
  SERIALIZE_ENTER, SERIALIZE_EXIT
} from "./traversal/executors/index.js";


/** @import { TraversalContextOptions } from './traversal/traversal-context.js' */
/** @import { ISchema, ISchemaOptions, ISchemaMetadata, SchemaData, TraversalOptions, ValidateOptions, SerializeOptions, ProcessOptions } from './types.js' */

/** @typedef {ISchemaMetadata} CompiledSchemaMetadata */
/** @typedef {ISchemaOptions} CompiledSchemaOptions */

/**
 * @typedef {object} CompiledSchemaHandlers
 * @property {Array<ValueProcessor>} [normalizers]
 * @property {Array<ValueProcessor>} [conditions]
 * @property {Array<ValueProcessor>} [transformers]
 * @property {Array<ValueProcessor>} [validators]
 * @property {Array<ValueProcessor>} [serializers]
 * @property {Array<ValueProcessor>} [discriminators]
 */

/** @typedef {{[key:string]:CompiledSchema}} CompiledSchemaProperties */
/** @typedef {{[key:string]:CompiledSchema}} CompiledSchemaUnionSchemas */

/**
 * CompiledSchema - the resolved version of a schema usable for processing input values into output values
 *
 * The SchemaResolver compiler takes an input Schema and constructs a CompiledSchema:
 * - The base schema hierarchy is resolved and flattened.
 * - Handlers have their input specifications converted into value processor executors.
 * - Unions may trigger property hoisting and discriminator synthesis.
 * - Core options are converted to standardized forms.
 * - Metadata is expanded by introspecting the resolved schema.
 * - Errors are thrown if the input Schema is invalid, inconsistent, or missing required data.
 *
 * @augments {ISchema}
 */
export class CompiledSchema
{
  /** @internal */
  static __TOKEN = Symbol('CONSTRUCT_USING_COMPILER')

  /** @type {Map<string,CompiledSchema>} */
  #propertiesMap = new Map();
  /** @type {CompiledSchemaProperties|undefined} */
  #properties;
  /** @type {Map<string,CompiledSchema>} */
  #unionSchemasMap = new Map();
  /** @type {CompiledSchemaUnionSchemas|undefined} */
  #unionSchemas;
  /** @type {Map<string, ValueProcessor>} */
  #valueProcessorMap = new Map();

  /** @type {CompiledSchemaHandlers} */
  #handlers = {};
  /** @type {CompiledSchemaOptions} */
  #options = {};
  /** @type {CompiledSchemaMetadata} */
  #metadata = {};
  /** @type {boolean} */
  #frozen = false;
  /** @type {Set<any>} */
  #values = new Set();

  /**
   * CompiledSchema constructor - do not call directly (use SchemaResolver.compile())
   *
   * @param {symbol} token - magic to reduce shenanigans
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
   * @type {IteratorObject<[string, CompiledSchema]>}
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

  getValueProcessor(processorName) {
    return this.#valueProcessorMap.get(processorName);
  }

  /**
   *
   * @param {string} processorName
   * @param {ValueProcessor} valueProcessor
   * @returns {ValueProcessor}
   * @internal
   */
  _setValueProcessor(processorName, valueProcessor) {
    this.#valueProcessorMap.set(processorName, valueProcessor);
    return valueProcessor;
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
   * @type {IteratorObject<[string, CompiledSchema]>}
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
   * Return true if the schema always returns an inherited or referenced value.
   *
   * Referenced properties never accept a direct assignment, and will always return the value
   * corresponding to the first matching property name found higher in the schema.
   *
   * @type {boolean}
   */
  get isReference() {
    return this.options.reference ?? false;
  }

  /**
   * Returns true if this schema defines a value that can be assumed to always exist and be valid.
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
   * Opaque schemas will typically need a custom validator that understands the post-transform contract.
   *
   * Transformation of opaque schemas is delayed until all known child assignments have been staged into a
   * pending container.  Once an opaque schema is transformed, it no longer accepts assignments.  (This
   * may cause sequencing issues with late-resolved conditional assignments!)
   *
   * @type {boolean}
   */
  get isOpaque() {
    return !this.hasChildren || this.options.allowIncremental === false;
  }

  /**
   * Check if the provided value (and/or current output target) passes the schema conditional check.
   *
   * Schemas that don't have a condition handler defined will always succeed.
   *
   * Failed conditions will be repeatedly re-checked during assignment processing until the final pass.
   * Errors encountered while checking conditions are caught and simply result in a failed condition.
   *
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {object} [options]
   * @returns {boolean|Promise<boolean>}
   * @internal
   */
  _checkCondition(value, target, location = new SchemaLocation(this), options) {
    if (location.schema !== this) {
      return location.schema._checkCondition(value, target, location, options);
    }
    const conditional = this.getValueProcessor('conditions');

    if (!conditional) {
      return true;
    }
    try {
      const result = conditional.execute(value, target, location, options);

      if (result instanceof Promise) {
        return result.then(
          resolved => isTruthy(resolved),
          _ => false
        );
      }
      return isTruthy(result);
    }
    catch (error) {
      return false;
    }
  }
  /**
   * Check if the provided value (and/or current output target) passes the schema conditional check.
   *
   * Failed conditions will be repeatedly re-checked during assignment processing until the final pass.
   * Errors encountered while checking conditions are caught and simply result in a failed condition.
   *
   * (This an async wrapper around the internal `_checkCondition` executor function.)
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {object} [options]
   * @returns {Promise<boolean>}
   * @internal
   */
  async checkCondition(value, target, location = new SchemaLocation(this), options) {
    return this._checkCondition(value, target, location, options);
  }

  /**
   * Return true if this schema is conditional
   *
   * @returns {boolean}
   */
  get hasConditions() {
    const conditions = this.handlers.conditions;
    return Boolean(conditions && Array.isArray(conditions) && conditions.length);
  }

  /**
   * Use the registered discriminator to return a matching union schema, or undefined if the union cannot be resolved.
   * Discriminator functions must return either one of the unionSchema members, a unionSchema key, or undefined.
   *
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {object} [options]
   * @returns {CompiledSchema|undefined|Promise<CompiledSchema|undefined>}
   * @internal
   */
  _discriminateUnion(value, target, location = new SchemaLocation(this), options = {}) {
    if (location.schema !== this) {
      return location.schema._discriminateUnion(value, target, location, options);
    }
    const discriminator = this.getValueProcessor('discriminators');

    if (!this.isUnion || !discriminator) {
      return undefined;
    }
    let result;
    try {
      result = discriminator.execute(value, target, location, options);
    }
    catch (error) {
      if (options?.strict) {
        throw error;
      }
      return undefined;
    }
    if (result instanceof Promise) {
      return result.then(
        resolved => this.getUnionSchema(resolved),
        rejected => {
          if (options.strict) { throw rejected; }
          return undefined;
        });
    }
    return this.getUnionSchema(result);
  }
  /**
   * Use the registered discriminator to return a matching union schema, or undefined if the union cannot be resolved.
   * Discriminator functions must return either one of the unionSchema members, a unionSchema key, or undefined.
   *
   * (This an async wrapper around the internal `_discriminateUnion` executor function.)
   *
   * @param {any} value
   * @param {any} [target]
   * @param {SchemaLocation} [location]
   * @param {object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   * @internal
   */
  async discriminateUnion(value, target, location = new SchemaLocation(this), options) {
    return this._discriminateUnion(value, target, location, options);
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
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value - value to normalize
   * @param {any} [target] - top level output target being built (avoid using for normalizers!)
   * @param {SchemaLocation} [location] - path to this value in the output target
   * @param {object} [options] - optional tweaks to normalizer behavior
   * @returns {any|Promise<any>}
   * @internal
   */

  _normalizeValue(value, target, location = new SchemaLocation(this), options = {}) {
    if (location.schema !== this) {
      return location.schema._normalizeValue(value, target, location, options);
    }
    const dynamic = options?.dynamic ?? this.options?.dynamic ?? true;  // todo - make dynamic default to false?

    if ((typeof value === 'function' || value instanceof ValueProcessor) && dynamic && !options.compiling) {
      const result = (value instanceof ValueProcessor)?
                     value.execute(true, target, location, options) : value(true, target, location, options);

      if (result instanceof Promise) {
        return result.then(resolved => {
          if (resolved === undefined || resolved === null) {
            return resolved;  // a dynamic function must not fall back to defaults
          }
          // recurse so that we pick up the normal flow.
          return this._normalizeValue(resolved, target, location, {...options, dynamic: false});
        })
      }
      value = result;  // fall through...
    }

    if (value === null || (value === undefined && !this.options.allowUndefined)) {
      return value;
    }

    const normalizer = this.getValueProcessor('normalizers');
    if (normalizer === undefined) {
      // If we are a container type without a normalizer, create a default container if passed true
      // todo - consider making this a compilation error!  all container schemas need a normalizer of some sort!
      if (this.hasChildren && value === true) {
        return this.isArray? [] : {}
      }
      return value;
    }
    let result;
    try {
      result = normalizer.execute(value, target, location, options);
    }
    catch (error) {
      throw new NormalizeError('Unable to normalize', {location, cause: error});
    }

    if (result instanceof Promise) {
      return result.then(
        resolved => resolved,
        rejected => { throw new NormalizeError('Unable to normalize', {value, location, cause: rejected})}
      );
    }
    return result;
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
   * (This an async wrapper around the internal `_normalizeValue` executor function.)
   *
   * @param {any} value - value to normalize
   * @param {any} [target] - top level output target being built (avoid using for normalizers!)
   * @param {SchemaLocation} [location] - path to this value in the output target
   * @param {object} [options] - optional tweaks to normalizer behavior
   * @returns {Promise<any>}
   * @internal
   */

  async normalizeValue(value, target, location = new SchemaLocation(this), options) {
    return this._normalizeValue(value, target, location, options)
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
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value - input value to transform
   * @param {any} [target] - global target in case the transformer depends on it
   * @param {SchemaLocation} [location] - the traversal location of the schema
   * @param {object} [options] - any tweaks to the transformer behavior
   * @returns {any|Promise<any>} - transformed value
   * @internal
   */
  _transformValue(value, target, location = new SchemaLocation(this), options = {}) {
    if (location.schema !== this) {
      return location.schema._transformValue(value, target, location, options);
    }
    if (this.isImplicit) {
      throw new TransformError('Cannot transform a value for an implicit schema', {location});
    }
    if (value === null || (value === undefined && !this.options.allowUndefined)) {
      return value;
    }
    let result;
    try {
      this.ensureAccepts(value);
      const transformer = this.getValueProcessor('transformers');
      if (transformer === undefined) {
        return value;
      }
      result = transformer.execute(value, target, location, options);
    }
    catch (error) {
      throw new TransformError('Unable to transform', {value, location, cause: error});
    }
    if (result instanceof Promise) {
      return result.then(
        resolved => resolved,
        rejected => { throw new TransformError('Unable to transform', {value, location, cause: rejected}) }
      );
    }
    return result;
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
   * @param {object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   * @internal
   */
  async transformValue(value, target, location = new SchemaLocation(this), options) {
    return this._transformValue(value, target, location, options);
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
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value - value to validate
   * @param {any} [target] - complete output target
   * @param {SchemaLocation} [location] - traversal location of this schema
   * @param {object} [options] - options to tweak validation behavior
   * @returns {any|Promise<any>}
   * @internal
   */
  _validateValue(value, target, location = new SchemaLocation(this), options = {}) {
    if (location.schema !== this) {
      return location.schema._validateValue(value, target, location, options);
    }
    if (this.required === true && value === undefined) {
      throw new ValidationError('Missing required value', {location});
    }
    if (value === null || value === undefined) {
      return value;
    }

    const validator = this.getValueProcessor('validators');

    if (!validator) {
      return value;
    }
    const revalidate = options?.revalidate ?? location.schema.options?.revalidate ?? true;

    let result;
    try {
      result = validator.execute(value, target, location, options);
    }
    catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // for debugging: result = validator.execute(value, target, location, options);
      throw new ValidationError('Validation failed', {value, location, cause: error});
    }
    if (result instanceof Promise) {
      return result.then(
        resolved => {
          if (resolved !== value && resolved !== undefined && revalidate) {
            return this._validateValue(resolved, target, location, {...options, revalidate: false})
          }
          return (resolved === undefined)? value : resolved;
        }, // validation cannot clear data
        rejected => {
          if (rejected instanceof ValidationError) {
            throw rejected;
          }
          throw new ValidationError('Validation failed', {value, location, cause: rejected});
        }
      );
    }
    if (result !== value && result !== undefined && revalidate) {
      return this._validateValue(result, target, location, {...options, revalidate: false})
    }
    return (result === undefined)? value : result;

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
   * @param {object} [options] - options to tweak validation behavior
   * @returns {Promise<any>}
   * @internal
   */
  async validateValue(value, target, location, options) {
    return this._validateValue(value, target, location, options);
  }


  /**
   * Serialize the provided input value.
   *
   * (This is an executor function that may return synchronous or asynchronous results.)
   *
   * @param {any} value - value to serialize
   * @param {any} [target] - entire output being serialized
   * @param {SchemaLocation} [location] - traversal location to current schema
   * @param {object} [options] - options to tweak serialization behavior
   * @returns {any|Promise<any>}
   * @internal
   */
  _serializeValue(value, target, location = new SchemaLocation(this), options = {}) {
    if (location.schema !== this) {
      return location.schema._serializeValue(value, target, location, options);
    }

    if (value === undefined || value === null || this.isImplicit || isTruthy(this.metadata.omitFromSerialize)) {
      return null;
    }
    const serializer = this.getValueProcessor('serializers');

    if (!serializer) {
      if (this.hasChildren) {
        return this.isArray? [] : {}
      }
      return value;
    }

    let result;
    try {
      result = serializer.execute(value, target, location, options);
    }
    catch (error) {
      if (options?.strict) {
        throw new SerializeError('Unable to serialize', {value, location, cause: error});
      }
      return undefined;
    }
    if (result instanceof Promise) {
      return result.then(
        resolved => resolved,
        rejected => {
          if (options?.strict) {
            throw new SerializeError('Unable to serialize', {value, location, cause: rejected});
          }
          return undefined;
        }
      );
    }
    return result;
  }
  /**
   * Serialize the provided input value.
   *
   * @param {any} value - value to serialize
   * @param {any} [target] - entire output being serialized
   * @param {SchemaLocation} [location] - traversal location to current schema
   * @param {object} [options] - options to tweak serialization behavior
   * @returns {Promise<any>}
   * @internal
   */
  async serializeValue(value, target, location = new SchemaLocation(this), options) {
    return this._serializeValue(value, target, location, options);
  }

  /**
   * Throw an exception if this schema seems to be able to handle a given input value.
   *
   * @param {any} value
   */
   ensureAccepts(value) {
    if (value === undefined) {
      if (this.options.allowUndefined) {
        return;
      }
      throw new ValidationError('Schema does not accept an undefined input');
    }
    if (!Array.isArray(this.values)) {
      return;
    }
    const found = this.values.some(v => deepEquals(v, value));

    if (!found) {
        // todo - consider using valueDescription metadata
      throw new ValidationError(`Invalid value «${value}», expected one of {${this.values.join('|')}}`);
    }
    return;
  }

  /**
   * @param {any} value
   * @returns {boolean}
   */
  checkAccepts(value) {
     try {
       this.ensureAccepts(value);
       return true;
     }
     catch (e) {
       return false;
     }
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
    const result = await this.traverse(target, {context, enterExecutor: PRELOAD_ENTER, exitExecutor: PRELOAD_EXIT });

    return result;
  }


  /**
   * Normalize the input value.
   *
   * Unlike normalizeValue, this will normalize an entire object hierarchy, starting at the root.
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

    const result = await this.traverseMultipass(input, {context, enterExecutor: NORMALIZE_ENTER, exitExecutor: NORMALIZE_EXIT});

    return result;
  }

  /**
   * Transform the input value.
   *
   * Unlike transformValue, this assumes it starts at the root, and will normalize and transform an entire object hierarchy.
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
    const result = await this.traverseMultipass(input, {context, enterExecutor: TRANSFORM_ENTER, exitExecutor: TRANSFORM_EXIT});

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

    for (const state of context.stateMap.values()) {
      state.completed = false;
    }

    return await this.traverseMultipass(value, {context, enterExecutor: VALIDATE_ENTER, exitExecutor: VALIDATE_EXIT })
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

    for (const [inputPath, input] of assignments) {
      context.setAssignedInput(input, inputPath);
    }

    return await this.traverseMultipass(undefined, {context, enterExecutor: PROCESS_ENTER, exitExecutor: PROCESS_EXIT});
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
    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(location, {strict: options?.strict, deep: options?.deep, debug: options?.debug});

    if (target !== undefined) {
      await this._preload(target, context);
    }

    const result = await this.traverseMultipass(input, {context, enterExecutor: PROCESS_ENTER, exitExecutor: PROCESS_EXIT});
    return result;
    //return await this.traverse(result, {context, hooks: postProcessValidationHooks});
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
   * @param {any} value
   * @param {SerializeOptions} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(value, options = {}) {
    const location = options?.location ?? new SchemaLocation(this);
    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(location, {strict: options?.strict, deep: options?.deep, debug: options?.debug});

    // should be able to single-shot serialization
    const result = await this.traverse(value, {context, enterExecutor: SERIALIZE_ENTER, exitExecutor: SERIALIZE_EXIT });

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
   * Given a union key or schema, retrieve the matching union schema, or undefined if it cannot be found or is invalid
   *
   * @param {string|CompiledSchema} lookup
   * @returns {CompiledSchema|undefined}
   */
  getUnionSchema(lookup) {
    if (!lookup) {
      return undefined
    }
    if (typeof lookup === 'string') {
      if (!this.isUnion) {
        throw new SchemaError(`Cannot get union schema with key "${lookup}" because schema is not a union`);
      }
      if (this.#unionSchemasMap.has(lookup)) {
        return this.#unionSchemasMap.get(lookup);
      }
      throw new SchemaError(`Unknown union schema key "${lookup}"`)
    }
    if (lookup instanceof CompiledSchema) {
      if (!this.isUnion) {
        throw new SchemaError('Schema is not a union');
      }
      if (this.findUnionKey(lookup)) {
        return lookup;
      }
      throw new SchemaError('Schema is not a union member');
    }
    throw new SchemaError('Unable to get union schema with provided data');
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

    for (const pathComponent of pathComponents) {
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
        return;
      }
      walked.add(schema);
      if (schema.metadata.omitFromSerialize && onlySerializable) {
        return;
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
            return;
          }
        }
      }
      return visitor(schema, path);
    }
    return walk(this, '') ?? true;
  }

  /**
   * Traverse the provided input data based on the current schema using executors
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

    // todo - this entire call should probably move to TraversalContext.

    const context = options?.context ?? new TraversalContext(new SchemaLocation(this)).finalize();

    const enterExecutor = options?.enterExecutor;
    const exitExecutor = options?.exitExecutor;

    const target = options?.target;
    const rootState = context.getState('');

    if (rootState.schema !== this) {
      // union?


    }

    const inputPath = options?.inputPath;  // the relative path from this schema to the input

    if (target !== undefined) {
      await this._preload(target, context);
    }
    context.setAssignedInput(input, inputPath);

    const executor = new TraversalStateExecutor(enterExecutor, exitExecutor);

    const result = executor.execute(rootState);

    if (result instanceof Promise) {
      return result.then(_ => {
        return context.getValue();
      })
    }
    else {
      return context.getValue();
    }
  }



  /**
   * Repeatedly traverse the provided input data based on the current schema until it stabilizes (or an error occurs)
   *
   * See traverse() for more details.
   *
   * @param {any} input
   * @param {object} [options]
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
      const counter = context.counter;
      //context._debug(`****** MULTIPASS TRAVERSAL ${context.traversals} STARTS ******`)

      result = await this.traverse(input, options);

      if (context.isComplete) {
        break;
      }

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
   * @returns {CompiledSchema}
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
   * @param {Set<CompiledSchema>} [seen]
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
