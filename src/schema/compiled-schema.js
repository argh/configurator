import { strict as assert } from 'assert';
import {
  ConstraintError,
  NormalizeError, ProcessorError,
  SchemaError,
  SerializeError,
  TransformError,
  ValidationError
} from '../errors.js';
import { deepAssign, deepEquals, deepPrune, deepValue, isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { expandWildcards } from './helpers/wildcard.js';
import { existingAssignment } from './helpers/assignments.js';
import { fpm } from './helpers/fpm.js';
import { checkConsistency } from './helpers/check-consistency.js';
import {
  deferContainer,
  checkRequiredHook,
  normalizeHook,
  transformHook,
  validateHook,
  resolveUnionHook,
  startPropertyHook,
  endPropertyHook,
  TraversalContext,
  TraversalControl,
  pendingToValueHook,
  checkConditionHook,
  existingPropertyHook,
  inputToPendingHook,
  checkPropertySchema,
  defaultsHook,
  serializeHook,
  checkUnresolvedHook,
  filterPropertyHook,
  TraversalHooks,
  inputToValueHook,
  normalizeInputHook, copyPropertyValueHook, simplePendingHook
} from './helpers/traversal.js';
import { stringify } from './helpers/stringify.js';


/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueProcessor, AsyncSchemaValueProcessor, AsyncSchemaValueVisitorFunction, AssignmentOptions, VisitOptions, SerializeOptions, ValidateOptions, PopulateOptions, CompiledValueProcessorDefinition } from './types.js' */

/** @typedef {import('./types.js').ISchemaMetadata} CompiledSchemaMetadata */

/** @typedef {ISchemaOptions} CompiledSchemaOptions
 */

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
 * CompiledSchema - the resolved version of a schema usable for processing configuration assignments
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
 * @typedef {import("./types.js").ISchema} ISchema
 * @implements ISchema
 */
export class CompiledSchema
{
  static __TOKEN = Symbol('CONSTRUCT_USING_RESOLVER')
  static __IGNORE = Symbol('IGNORE VALUE')
  static __STAGED = Symbol('STAGED');

  /**
   * CompiledSchema constructor - do not call directly (use SchemaResolver.compile())
   *
   * @param {Symbol} token - magic to reduce shenanigans
   * @param {CompiledSchema|undefined} [parent] - parent schema when added as a child
   * @param {string|undefined} [name] - property name within parent when added as a child
   */
  constructor(token, parent, name) {
    if (token !== CompiledSchema.__TOKEN) {
      throw new SchemaError('CompiledSchema must be created via compilation');
    }
    /** @type {string|undefined} */
    this._name = name;
    /** @type {CompiledSchema|undefined} */
    this._parent = parent;
    /** @type {CompiledSchemaProperties} */
    this._properties = {};
    /** @type {CompiledSchemaHandlers} */
    this._handlers = {};
    /** @type {CompiledSchemaOptions} */
    this._options = {};
    /** @type {CompiledSchemaMetadata} */
    this._metadata = {};
    /** @type {CompiledSchemaUnionSchemas} */
    this._unionSchemas = {};
  }

  /**
   * The name of the parent schema property that references this schema.  If there is no parent, returns undefined.
   *
   * @type {string|undefined}
   */
  get name() {
    return this._name;
  }

  /**
   * The parent schema that has this schema as a property. If there is no parent, returns undefined.
   *
   * @type {CompiledSchema|undefined}
   */
  get parent() {
    return this._parent; // overridden just for type narrowing
  }

  /**
   * The path to this schema within the entire schema hierarchy.
   *
   * - The root schema path is an empty string.
   * - Due to wildcard properties, the schema path may not match match the traversal path of a resolved configuration.
   * - Union schemas all return their path as if they were co-located with their union.
   * TODO - add union key?
   *
   * @type {string}
   */
  get path() {
    if (!this.name) {
      return '';  // this is an unattached schema, no path.
    }
    const parent = this.parent;
    return parent?.path ? `${parent.path}.${this.name}` : `${this.name}`;
  }

  /**
   * Options contains information that changes schema parsing and processing.
   *
   * @type {CompiledSchemaOptions}
   */
  get options() {
    return this._options;
  }

  /**
   * Metadata contains information for describing the schema behavior to users and hints for configuration sources.
   *
   * @type {CompiledSchemaMetadata}
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * Properties are named child schemas, defining a hierarchical schema structure.
   * - Property schemas are always unique instances, copied during compilation, and not shared.
   * - Each child schema has a "name" that will always equal the property name within this schema.
   * - Each child schema has a "parent" that will always reference this schema.
   *
   * @type {CompiledSchemaProperties}
   */
  get properties() {
    return this._properties;
  }

  /**
   * Handlers are associated with asynchronous value processors.
   *
   * The "friendly" handler definitions from the source Schema are each compiled into asynchronous functions
   * that run as a pipeline.
   *
   * All handlers have the same async signature, receiving:
   *   1. a value to be processed by the current schema
   *   2. a reference to the top-level aggregate being built or processed by the entire schema hierarchy
   *   3. a reference to the active schema that is processing the value
   *   4. the traversal path to the active schema (may not match schema path in event of wildcards!)
   *   5. any (unmanaged / developer defined) options passed to whatever invoked the handler processing
   *
   * The compiled handlers may vary in their return types and exception handling behavior.
   *
   * @type {CompiledSchemaHandlers}
   */
  get handlers() {
    return this._handlers;
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
    return this._unionSchemas;
  }

  /**
   * Extract this schema as a raw data object.
   *
   * @returns {SchemaData|undefined}
   */
  toData() {
    return toData(this);
  }

  /**
   * Return true if this schema has any child schemas.
   *
   * @type {boolean}
   */
  get hasChildren() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const _ in this._properties) {
      return true;
    }
    return false;
  }

  /**
   * Return true if this schema defines an array.
   *
   * Arrays sometimes need special treatment; the built-in 'array' base schema sets this option.
   *
   * @type {boolean}
   */
  get isArray() {
    return this._options.type === 'array';
  }

  /**
   * Return true if this schema defines a function value.
   *
   * Functions passed to most operations are interpreted as dynamic values (called to retrieve actual value).
   * This setting overrides that behavior, and forces a passed function to be treated as a simple value.
   *
   * @returns {boolean}
   */
  get isFunction() {
    return this._options.type === 'function'
  }


  /**
   * Return true if this schema defines a union.
   * Unions adopt the behavior of one of their unionSchema member elements based on a discriminator handler function.
   *
   * @type {boolean}
   */
  get isUnion() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const _ in this._unionSchemas) {
      return true;
    }
    return false;
  }

  /**
   * Return true if this schema is used to select union keys.
   * (This doesn't guarantee that there is a matching discriminator that uses it!)
   * @type {boolean}
   */
  get isUnionKey() {
    return !!this._options.unionKey;
  }

  /**
   * Return true if the schema acts as a selector.
   * Selectors control the activation or deactivation of peer selection schemas using a conditional handler
   * synthesized during compilation.
   *
   * @type {boolean}
   */
  get isSelector() {
    return !!this._options.selector;
  }

  /**
   * Return true if this schema is a selection conditionally activated by a peer selector.
   *
   * @type {boolean}
   */
  get isSelection() {
    return this._options.selection !== undefined;
  }

  /**
   * Get the selector value that triggers this selection.  The default value for a selection is its own property name.
   *
   * @type {string|undefined}
   */
  get selection() {
    if (typeof this._options.selection === 'string') {
      return this._options.selection;
    }
    else {
      return this._options.selection ? this.name : undefined;
    }
  }

  /**
   * Return the legal (normalized) values this schema accepts, if defined.
   * (This acts as an "upstream" check before calling any processing handlers.)
   *
   * @type {Array<NonNullable<any>>|undefined}
   */
  get values() {
    return this._options.values;
  }

  /**
   * Return true if this schema seems to be able to handle a given input value.
   *
   * @param {any} value
   * @returns {Promise<boolean>}
   */
  async accepts(value) {
    let normalizedValue;
    try {
      normalizedValue = await this.normalizeValue(value);
      if (normalizedValue === undefined) {
        return false;
      }
    }
    catch (_) {
      return false;
    }
    if (!Array.isArray(this.values)) {
      return true;
    }
    return this.values.includes(normalizedValue);
  }

  /**
   * Returns true if the value defined by this schema is required to exist in the output to be valid.
   *
   * Under the normal pathways, this is a shallow requirement:
   * - Each schema validates its own input; if the required flag is set, the input must not be undefined.
   * - If the input value is defined and the schema has children, all child property schemas will
   *   recursively validate the corresponding child value inside the input.
   * - If the input value is undefined, child property schemas are NOT validated.
   *
   * (There can be subtle interplay between the "required" flag and the "default" setting, as defaults
   * can be deep or shallow, depending on library configuration!)
   *
   * @type {boolean}
   */
  get required() {
    return this._options.required ?? false;
  }

  /**
   * Returns whether this schema enforces strict/lax validation:
   * - returns true if the schema should always use strict validation
   * - returns false if the schema should always use lax validation
   * - if undefined, it's up to validator
   *
   * This setting is useful for preventing validation errors when transforms return objects
   * that contain extra properties with no matching schema definition.
   *
   * @type {boolean|undefined}
   */
  get strict() {
    return this._options.strict;
  }

  /**
   * Returns the default value this schema provides if the input is undefined.
   *
   * At the schema level, this is interpreted as a "shallow" default, and will only populate if
   * processing the top-level value, or if the immediate parent is processing a defined
   * container value.  This can be overridden by changing the "deep" schema option.
   *
   * @type {any|undefined}
   */
  get default() {
    return this._options.default;
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
    if (this._options.deep !== undefined) {
      return this._options.deep;
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
  get inherit() {
    return this._options.inherit ?? false;
  }

  /**
   * Returns true if this schema defines a value that can be assumed to always exist and be valid after transformation.
   *
   * The implicit setting implies that values passed to this schema should not be visited or validated.
   *
   * @type {boolean}
   */
  get implicit() {
    return this._options.implicit ?? false;
  }

  /**
   * Returns true if the container allows incremental assignment to children.
   * TODO - deprecate, flip logic, rename to "opaque".
   *
   * @returns {boolean}
   * @deprecated
   */
  get allowIncremental() {
    return this._options.allowIncremental ?? this.hasChildren;
  }

  /**
   * Returns true if the schema defines a value whose internals are hidden after transformation.
   *
   * @returns {boolean}
   */
  get opaque() {
    return !this.hasChildren || this._options.allowIncremental === false;
  }

  async oldProcessAssignments(assignments, configuration, options) {

    if (this.parent) {
      throw new SchemaError('Can only process assignments using the root schema');
    }

    // We can't handle magic paths in this approach:
    for (const path of assignments.keys()) {
      if (path.includes('*') /*|| path.includes(':')*/) {
        assignments.delete(path);
      }
    }
    let input;
    for (const [path, value] of assignments) {
      input = deepAssign(input, path, value);
    }

    return await this.process(input, configuration,{strict: options?.strict ?? true, value: configuration, assignments});
  }






  /**
   * Check if the provided value passes the schema conditional check.
   *
   * Failed conditions will be repeatedly re-checked during assignment processing until the final pass.
   * Errors encountered while checking conditions are caught and simply result in a failed condition.
   *
   * @param {any} value
   * @param {any} configuration
   * @param {string} path
   * @param {Object} [options]
   * @returns {Promise<boolean>}
   */
  async checkCondition(value, configuration, path, options) {
    const conditions = Array.isArray(this._handlers.conditions)? this._handlers.conditions : [];

    // no conditions = pass!
    if (conditions.length === 0) {
      return true;
    }

    let checked = value;
    for (const condition of conditions) {
      try {
        checked = await condition.processor(checked, configuration, this, path, options);
      }
      catch (error) {
        return false;  // exception = failed condition check
      }
    }
    return Boolean(checked);
  }


  /**
   * Ensure the input is of an expected shape that can be handled by this schema.
   *
   * Runs all normalizer value processors in a pipeline until one returns undefined or throws an error.
   * As most external configuration will originate in the form of strings or JSON
   * structures, the main task of a normalizer is to "canonicalize" these inputs:
   * - The normalized output should be accepted by the transformer handler.
   * - Normalizers should pass through valid transformed values unchanged.
   * - By contract, when passed "true", a container schema should construct an "empty"
   *   container (e.g. {} or []).  (Even a schema that defines transformation to a
   *   complex class should have a normalized empty container format to use for construction).
   *
   * The normalize process will throw an exception if the input is incompatible.
   *
   * Unlike other handlers, normalizers should generally not depend on the overall
   * configuration state, as they are sometimes invoked in isolation (even during compilation!)
   * and thus shouldn't depend on the "undefined means retry later" behavior of other handlers.
   *
   * Also note that normalizeValue does not recursively examine child properties.
   *
   * @param {any} value
   * @param {any} [configuration]
   * @param {string} [path]
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async normalizeValue(value, configuration, path = this.path, options) {
    if (typeof value === 'function' && !isConstructor(value)) {
      if (this.options.type !== 'function') {
        try {
          value = await value(true, configuration, this, path, options);
        }
        catch (error) {
          throw new NormalizeError(fpm('Exception calling value function', path), {cause: error});
        }
      }
    }

    if (value === undefined || value === null) {
      return value;
    }

    const normalizers = Array.isArray(this._handlers.normalizers)? this._handlers.normalizers : [];

    let normalized = value;
    for (const normalizer of normalizers) {
      try {
        normalized = await normalizer.processor(normalized, configuration, this, path, options);
      }
      catch (error) {
        throw new NormalizeError(fpm('Could not normalize', path), {cause: error});
      }
    }
    return normalized;
  }

  /**
   * Transform an input value for the final configuration based on this schema and provided context.
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
   * @param {any} value - input value to transform
   * @param {any} configuration - global configuration in case the transformer depends on it
   * @param {string} path - the path to this value in the global configuration (caller will set)
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async transformValue(value, configuration, path = this.path, options) {
    if (value === null || value === undefined) {
      return value;
    }

    const strict = this.strict ?? options?.strict ?? true;

    // If we have define legal values, the input (or the normalized version of the input) must be found.
    if (Array.isArray(this.values) && this.values.length > 0) {
      if (!this.values.includes(value) && !this.values.some(v => deepEquals(v, value))) {
        const normalized = await this.normalizeValue(value, configuration, path, options);
        if (!this.values.includes(normalized) && !this.values.some(v => deepEquals(v, normalized))) {
          if (strict) {
            throw new TransformError(
              fpm(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`, path));
          }
          else {
            return undefined;  // we cannot transform this, at least not right now.
          }
        }
      }
    }

    const transformers = Array.isArray(this._handlers.transformers)? this._handlers.transformers : [];

    let transformed = value;
    for (const transformer of transformers) {
      try {
        transformed = await transformer.processor(transformed, configuration, this, path, options);
      }
      catch (error) {
        throw new TransformError(fpm('Unable to transform', path), {cause: error})
      }
    }
    return transformed;
  }

  async validateValue(value, configuration, path = this.path, options) {
    if (this.required === true && value === undefined) {
      throw new ValidationError(fpm('Missing required value', path));
    }
    if (value === null || value === undefined) {
      return value;
    }
    /*
    if (this.values?.length) {
      // todo - this a transform prerequisite, not a post-transform validation check!  remove code
      if (!this.values.includes(value)) {

        let found = this.values.some(v => deepEquals(v, value));
        if (!found) {
          throw new ValidationError(fpm(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`, path));
        }

        // fixme - old approach
        // complex object values are stored as strings!
//        if (!this.values.includes(stringify(value))) {
//          throw new ValidationError(fpm(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`, path));
//        }
      }
    }

     */
    const validators = Array.isArray(this._handlers.validators)? this._handlers.validators : [];

    let validated = value;
    for (const validator of validators) {
      try {
        validated = await validator.processor(validated, configuration, this, path, options);
      }
      catch (error) {
        throw new ValidationError(fpm(`Unable to validate "${value}"`, path), {cause: error});
      }
    }
    return validated ?? value;  // validators cannot clear the value, they can only throw
  }

  async serializeValue(value, configuration, path = this.path, options) {
    let serialized = value;
    const serializers = Array.isArray(this._handlers.serializers)? this._handlers.serializers : [];

    if (serializers.length === 0) {
      // fallback (?)
      if (this.hasChildren) {
        return this.isArray? [] : {}
      }
    }
    for (const serializer of serializers) {
      try {
        serialized = await serializer.processor(serialized, configuration, this, path, options);
      }
      catch (error) {
        if (options?.strict) {
          throw new SerializeError(fpm('Unable to serialize', path), {cause: error})
        }
        else {
          return undefined;
        }
      }
    }
    return serialized;
  }


  async preload(target, context) {
    if (!context) {
      context = new TraversalContext();
    }

    const hooks = new TraversalHooks()
      .hook('startCurrent', inputToValueHook)
      .hook('startProperty', copyPropertyValueHook)

    return await this.traverse(target, {hooks, context});
  }


  /**
   * @param {any} input - input value to normalize
   * @param {any} configuration - optional existing configuration
   * @returns {Promise<any>} - normalized value
   */
  async XXXXXnormalize(input, configuration) {
    const context = new TraversalContext({strict: false});

    if (configuration !== undefined) {
      await this.preload(configuration, context);
    }

    const hooks = new TraversalHooks()
      .hook('startCurrent', [defaultsHook, normalizeHook, resolveUnionHook])
      .hook('endCurrent', [pendingToValueHook, resolveUnionHook])
      .hook('startProperty', [startPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    const result = await this.traverseMultipass(input, {hooks, context});

    return result;
  }

  /**
   * @param {any} input - input value to transform
   * @param {import('./helpers/traversal.js').TraversalOptions} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async XXXXXtransform(input, options) {

    const context = new TraversalContext(options);

    const hooks = new TraversalHooks()
      .hook('startCurrent', [defaultsHook, normalizeInputHook, resolveUnionHook, checkConditionHook, normalizeHook, transformHook])
      .hook('endCurrent', [transformHook, resolveUnionHook])
      .hook('startProperty', [startPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    const result = await this.traverseMultipass(input, {hooks, context});

    return result;
  }

  /**
   * Return a validated output if and only if the input fully matches the schema definition.
   *
   * Runs all validator processors in a pipeline until one returns undefined or throws an error:
   * - The validation input is assumed to already have been transformed.
   * - If the input data is invalid, the validate call will throw an error.
   *
   * @param {any} value - input value to validate
   * @param {import('./helpers/traversal.js').TraversalOptions} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(value, options) {
    let traversalOptions = {value, ...options};
    const context = new TraversalContext(traversalOptions);
    const hooks = new TraversalHooks()
      .hook('startCurrent', [resolveUnionHook, checkConditionHook, inputToPendingHook])
      .hook('endCurrent', [resolveUnionHook, checkRequiredHook, checkUnresolvedHook, pendingToValueHook, validateHook])
      .hook('startProperty', [startPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    return await this.traverseMultipass(value, {hooks, context})
  }



  /** @typedef {import('./helpers/traversal.js').TraversalOptions} TraversalOptions */

  /** @typedef {Object} ProcessOptions
   * @property {TraversalContext|TraversalOptions} [context]
   */

  /**
   * @param {Map<string,any>} assignments
   * @param {any} [configuration]
   * @param {ProcessOptions & TraversalOptions} [options]
   * @returns {Promise<any>}
   */
  async processAssignments(assignments, configuration, options = {}) {

    const expanded = new Map([...expandWildcards(assignments), ...assignments]);
    for (const key of expanded.keys()) {
      if (key.includes('*')) {
        expanded.delete(key);
      }
    }

    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(options.context ?? options);
    const hooks = new TraversalHooks()
      .hook('startCurrent', [defaultsHook, normalizeInputHook, resolveUnionHook, checkConditionHook, normalizeHook, transformHook])
      .hook('endCurrent', [transformHook, resolveUnionHook, checkRequiredHook, validateHook /*, markValuesDone*/])
      .hook('startProperty', [startPropertyHook, filterPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    if (configuration !== undefined) {
      await this.preload(configuration, context);
    }
    for (let [path, value] of expanded) {
      await this.traverse(value, {inputPath: path, context, hooks});
    }
//    context.final = true;
    return await this.traverseMultipass(undefined, {context, hooks});
  }


  /**
   * Process an input value to an output value based on this schema
   * @param {any} input
   * @param {any} [configuration]
   * @param {ProcessOptions & TraversalOptions} [options]
   * @returns {Promise<any>}
   */
  async process(input, configuration, options = {}) {
    const context = (options.context instanceof TraversalContext) ? options.context : new TraversalContext(options.context ?? options);
    const hooks = new TraversalHooks()
      .hook('startCurrent', [defaultsHook, normalizeInputHook, resolveUnionHook, checkConditionHook, normalizeHook, transformHook])
      .hook('endCurrent', [transformHook, resolveUnionHook, checkRequiredHook, validateHook /*, markValuesDone*/])
      .hook('startProperty', [startPropertyHook, filterPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    if (configuration !== undefined) {
      await this.preload(configuration, context);
    }

    const result = await this.traverseMultipass(input, {context, hooks});

    return result;
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
    const context = new TraversalContext({strict: options?.strict ?? false});
    const hooks = new TraversalHooks()
      .hook('startCurrent', [simplePendingHook, resolveUnionHook, checkConditionHook, serializeHook])
      .hook('endCurrent', [])
      .hook('startProperty', [startPropertyHook, checkPropertySchema])
      .hook('endProperty', [endPropertyHook])

    if (configuration !== undefined) {
      context.setValue(configuration);  // serialization uses a fixed configuration
    }

    const result = await this.traverseMultipass(configuration, {hooks, context})

    // clean up any null markers or undefined keys
    return deepPrune(result);
    }

  /**
   * Use the registered discriminator to return a matching union schema, or undefined if the union cannot be resolved.
   * Discriminator functions must return either one of the unionSchema members, a unionSchema key, or undefined.
   *
   * @param {any} value
   * @param {any} configuration
   * @param {string} path
   * @param {object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   */
  async discriminateUnion(value, configuration, path, options) {
    if (value === undefined) {
// FIXME ?      return undefined;
    }

    const strict = options?.strict ?? false;

    if (!this.isUnion || this._handlers.discriminators === undefined) {
      return undefined;
    }

    const discriminators = Array.isArray(this._handlers.discriminators)? this._handlers.discriminators : [];

    // we'll run multiple discriminators if necessary, but it's a bizarre use case...

    let discriminatorResult = value;
    for (const discriminator of discriminators) {
      try {
        discriminatorResult = await discriminator.processor(discriminatorResult, configuration, this, path, options);
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
        throw new SchemaError(fpm('Unable to resolve union', path));
      }
      return undefined;
    }
    if (typeof discriminatorResult === 'string') {
      // String lookups (e.g., from property extraction) - return undefined if no match
      return this.unionSchemas[discriminatorResult];
    }
    if (discriminatorResult instanceof CompiledSchema && this.findUnionKey(discriminatorResult)) {
      return discriminatorResult;
    }
    // Schema returned but not valid - this is a developer error
    throw new SchemaError(fpm('Union discriminator returned unexpected value', path))
  }

  /**
   * Given a reference to a union schema member, return the matching key, or undefined if it cannot be found.
   *
   * @param {CompiledSchema} unionSchema
   * @returns {string|undefined}
   */
  findUnionKey(unionSchema) {
    return Object.keys(this.unionSchemas).find(key => this.unionSchemas[key] === unionSchema)
  }

  /**
   * Find the schema at a given path (supports wildcards and colon-delimited union keys in path components).
   * The root schema may be found at '', the empty string.  Array members are referenced with dotted integer indexes.
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
      const parts = pathComponent.split(':');
      if (parts.length > 1) {
        pathComponent = parts[0];
      }
      s = s?.properties[pathComponent] ?? s?.properties['*'];

      if (s?.isUnion && parts.length > 1) {
        s = s.unionSchemas[parts[1]];
      }

      if (!s) {
        return undefined;
      }
    }
    return s;
  }

  /**
   * Find the parent schema for a given path, even if parts of the path do not exist in the schema hierarchy.
   *
   * Given unknown path components, the result might be several levels higher than the provided path would imply!
   *
   * @param {string} path
   * @returns {CompiledSchema|undefined}
   */
  findParent(path) {
    if (!path || path === '' || path === '.') {
      return undefined;
    }
    const dot = path.lastIndexOf('.');

    if (dot === -1) {
      return this;
    }
    path = path.substring(0, dot);
    const parentSchema = this.find(path);
    if (parentSchema) {
      return parentSchema;
    }
    return this.findParent(path);
  }

  /**
   * Get the root schema that has this schema somewhere in its hierarchy (possibly itself)
   *
   * @returns {CompiledSchema}
   */
  getRoot() {
    /** @type {CompiledSchema} */
    let s = this;
    while (s.parent) {
      s = s.parent;
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

    function walk(schema, current, path) {
      const isContainer = Array.isArray(current) || isPlainObject(current);

      const allowIncremental = schema?.allowIncremental ?? true;
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (isContainer && hasChildren) {//} && allowIncremental) {
        const entries = Array.isArray(current)? current.entries() : Object.entries(current);

        for (const [key, value] of entries) {
          const propertySchema = schema?.getPropertySchema(key);
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
   * @param {{addUnionKeys?:boolean, onlySerializable?:boolean}} [options]
   * @returns {boolean} - returns true if visitors all returned true, false if any exited early
   */
  visitSchema(visitor, options) {
    const addUnionKeys = options?.addUnionKeys ?? false;
    const onlySerializable = options?.onlySerializable ?? false;
    /**
     * @param {CompiledSchema} schema
     * @param {string} path
     * @returns {any|boolean}
     */
    function walk(schema, path) {
      if (schema.metadata.omitFromSerialize && onlySerializable) {
        return false;
      }
      if (schema.hasChildren) {
        for (const propName in schema.properties) {
          const childPath = path ? `${path}.${propName}` : `${propName}`;
          if (walk(schema.properties[propName], childPath) === false) {
            return false;
          }
        }
      }
      if (schema.isUnion) {
        for (const unionSchemaKey in schema.unionSchemas) {
          const p = addUnionKeys ? `${path}:${unionSchemaKey}` : path;
          if (walk(schema.unionSchemas[unionSchemaKey], p) === false) {
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
   * @param {any} input
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async traverse(input, options) {
    const path = options?.path ?? '';
    const inputPath = options?.inputPath ?? '';

    const hooks = options?.hooks ?? new TraversalHooks();
    const context = options?.context ?? new TraversalContext().finalize();

    const target = options?.target;
    if (path === '' && target !== undefined) {
      await this.preload(target, context);
    }
    const strict = this.strict ?? options?.strict ?? true;

    const state = context.getState(path);

    const isInputPath = (inputPath === '');

    const initialize = async() => {
      if (state.schema === undefined) {
        state.schema = this;
      }

      if (isInputPath) {
        if (input !== undefined) {
          state.assignedInput = input;
          }
        if (state.assignedInput !== undefined) {
          if (state.treatAsExplicit) {
            state.isExplicit = true;
          }
        }
      } else {
        const fullInputPath = path? `${path}.${inputPath}` : inputPath;
        const inputState = context.getState(fullInputPath);
        if (input !== undefined && inputState.assignedInput !== input) {
          inputState.assignedInput = input;
        }
        if (state.assignedInput === undefined) {
          state.assignedInput = true;
        }
      }
      return TraversalControl.OK;
    }
    const startCurrent = async () => {
      return await hooks.startCurrent(state);
    }

    // todo - merge deepProperty / handleProperties?

    const deepProperty = async() => {
      if (!this.hasChildren || isInputPath) {
        return TraversalControl.OK;
      }

      const inputPathComponents = inputPath.split('.');
      const propertyKey = inputPathComponents.shift();
      const propertyInputPath = inputPathComponents.join('.')
      const property = state.context.getProperty(state, propertyKey);
      if (!property) {
        return TraversalControl.OK;
      }
      const startResult = await hooks.startProperty(state, property);

      if (startResult !== TraversalControl.OK) {
        return TraversalControl.OK;
      }

      property.value = await property.state.schema?.traverse(input, {context, hooks, path: property.state.path, inputPath: propertyInputPath});
      if (property.value !== undefined && state.pending === undefined && state.value === undefined) {
        // lazy container creation - todo - move into endProperty by passing hooks in?
        state.isExplicit = true;
        await hooks.startCurrent(state);  // todo - check errors/result
      }
      await hooks.endProperty(state, property);
    }

    const handleProperties = async() => {
      if (!this.hasChildren || !isInputPath) {
        return TraversalControl.OK;
      }
      const propertyKeys = new Set();
      if (isPlainObject(state.input) || Array.isArray(state.input)) {
        Object.keys(state.input).forEach(key => propertyKeys.add(key));
      }
      if (context.final) {
        Object.keys(this.properties).forEach(key => { if (key !== '*') { propertyKeys.add(key) } } );

        if (this.properties['*']) {
          // wildcard, so let's look for any interesting children in the state map
//          state.listPendingChildren().forEach(path => propertyKeys.add(path));
        }
      }
      // fixme
      state.listPendingChildren().forEach(path => propertyKeys.add(path));
      // fixme
      const container = state.pending ?? state.value;

      const existingProperties = (Array.isArray(container) && container.length) || (isPlainObject(container) && Object.keys(container).length);
// todo - think about this; state.input==undefined is an unreliable indicator of "no work to do" as we might have lingering conditions/etc for final pass
      if (!existingProperties && !state.isExplicit && state.input === undefined && !state.isDeep) {
        return;
      }

      if (existingProperties && context.final) {
        Object.keys(container).forEach(key => {
          if (strict || this.getPropertySchema(key)) {
            propertyKeys.add(key)
          }
        });
      }

      for (const propertyKey of propertyKeys.keys()) {
        const property = context.getProperty(state, propertyKey);
        if (!property) {
          continue;
        }
        const startResult = await hooks.startProperty(state, property);

        if (startResult === TraversalControl.SKIP) {
          continue;
        }
        else if (startResult === TraversalControl.STOP) {
          break;  // do we actually need this, or is it hypothetical?
        }

        const propertyOptions = {
          context,
          hooks,
          path: property.state.path
        }

        if (property.state.schema !== undefined) {
          property.value = await property.state.schema.traverse(property.input, propertyOptions);
        }

        if (property.value !== undefined && state.pending === undefined &&  state.value === undefined) {
          state.isExplicit = true;
          await hooks.startCurrent(state);  // todo - check errors?
        }
        const endResult = await hooks.endProperty(state, property);

        if (endResult === TraversalControl.STOP) {
          break;
        }
      }
      return TraversalControl.OK;
    }
    const endCurrent = async () => {
      return await hooks.endCurrent(state);
    }

    for (const phase of [initialize, startCurrent, isInputPath? handleProperties : deepProperty, endCurrent]) {
      const result = await phase() ?? TraversalControl.OK;
      if (state.schema !== this) {
        return state.schema?.traverse(input, options);
      }
      if (result !== TraversalControl.OK || state.value === null) {
        break;
      }
    }
    return state.value;
  }

  /**
   * Traverse the provided input data based on the current schema.
   *
   * @param {any} input
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async traverseMultipass(input, options) {
    let done = false;
    let result = undefined;

    const hooks = options?.hooks ?? new TraversalHooks();
    const context = options?.context ?? new TraversalContext();
    const path = options?.path ?? '';

    // ensure the root state exists so that the context doesn't already appear to be completed on the first pass
    const rootState = context.getState(path);

//    result = await this.traverse(input, options);
    // loop until context stabilizes
    while (!done) {
      let counter = context.counter;

      result = await this.traverse(input, options);
//      for (let p of context.incomplete) {
//        await this.traverse(context.getState(p).input, {hooks, context, path, inputPath: p})
//      }

//      result = rootState.value;

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
    }
    return result;
  }

  /**
   * Compute all possible schema paths (including union schema properties, optionally adding colon-delimited union keys)
   *
   * @param {{addUnionKeys: boolean?}} [options]
   * @returns {Set<string>}
   */
  getPropertyPaths(options) {
    const addUnionKeys = options?.addUnionKeys ?? false;
//    const flattenUnions = (options?.flattenUnions) ?? false;
//    const verboseUnions = (options?.verboseUnions) ?? false;
//    const wildcards = (options?.wildcards) ?? false;

    const propertyPaths = new Set();

    this.visitSchema((schema, path) => {
      if (path) {
        propertyPaths.add(path);
      }
    }, {addUnionKeys})
    return propertyPaths;
  }

  /**
   * Return a named property schema (possibly via wildcard)
   *
   * @param {string} propertyName
   * @param {string} [propertyUnionKey] union key in the child (not current)
   * @returns {CompiledSchema}
   */
  getPropertySchema(propertyName, propertyUnionKey) {
    if (propertyName === undefined || propertyName === '') {
      throw new SchemaError('Unable to retrieve an unnamed property');
    }
    let schema = this.properties[propertyName] ?? this.properties['*'];

    if (schema !== undefined && propertyUnionKey) {
      schema = schema.unionSchemas?.[propertyUnionKey];
    }
    return schema;
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
    for (const propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        schemas.push(schema);
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
    for (const propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        return schema;
      }
    }
    return undefined;
  }

  /**
   * Return true if the path is legal within the schema (including all union schemas)
   *
   * TODO - add support for explicit union keys?
   *
   * @param {string} path
   * @returns {boolean}
   */
  isValidPath(path) {
    if (path === '') {
      return true;  // means the current schema!
    }
    const parts = path.split('.');

    function check(schema, index = 0) {
      if (index >= parts.length) {
        return schema !== undefined;
      }
      const [propertyName, unionKey] = parts[index].split(':');

      if (schema.hasChildren && schema.getPropertySchema(propertyName)) {
        return check(schema.getPropertySchema(propertyName), index + 1);
      }
      else if (schema.isUnion) {
        if (unionKey) {
          if (!schema.unionSchemas[unionKey]) {
            return false;
          }
          return check(schema.unionSchemas[unionKey], index);
        }
        else {
          const unionSchemas = Object.values(schema.unionSchemas);

          for (const unionSchema of unionSchemas) {
            if (check(unionSchema, index)) {
              return true;
            }
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
  freeze() {
    for (const childSchema of Object.values(this._properties)) {
      childSchema.freeze();
    }
    Object.freeze(this._properties);
    Object.freeze(this._options);
    Object.freeze(this._metadata);
    for (const unionSchema of Object.values(this._unionSchemas)) {
      unionSchema.freeze();
    }
    Object.freeze(this._unionSchemas);
    Object.freeze(this);
  }
}


/**
 * Helper class for tracking assignment completion state
 * @internal
 */
class AssignmentStatus {
  constructor(path) {
    this.path = path;
    this.completed = false;
  }
}

/**
 * Helper class for tracking progress of all assignments
 * @internal
 */
class AssignmentProgress {
  constructor(rootSchema, assignments, strict = true) {
    this.schema = rootSchema;
    this.completed = new Map();
    /** @type {Map<string,{key:string,schema:CompiledSchema}>} */
    this.resolvedSchemas = new Map();
    this.conditions = new Map();
    this.required = new Map();
    this.staged = new Map();
    this.strict = strict;
    this.processing = {};
    this.final = false;

    this.pathStatus = new Map();

    this.assignments = new Map([...assignments]);

    this.counter = 0;
  }

  addAssignment(path, value) {
    if (!this.assignments.has(path)) {
      this.counter++;
    }
    this.assignments.set(path, value);

    this.setCompleted(path, false); // reprocess!  (todo - verify this is what we want)
  }

  addAssignments(assignments) {
    for (const [path, value] of assignments) {
      this.addAssignment(path, value);
    }
  }

  get remainingAssignmentCount() {
    return this.assignments.size;
  }

  get remainingAssignments() {

    // Sort the remaining assignments for processing.
    // We don't build this in advance because we may add new assignments on any given pass.
    // The primary goal is to ensure that any low-priority bulk assignments to containers (which are
    // generally split into individual assignments, but there isn't a requirement to do so) don't overwrite
    // individual child assignments to that container.  E.g. if foo.bar is an array, and you assign
    // foo.bar.0="z" and also foo.bar=["a", "b", "c"], we want foo.bar=["z", "b", "c"], not ["a", "b", "c"].
    // Since we're already here, we also prioritize selectors and discriminators, in order to reduce the
    // number of passes we need to take to get everything done.

    return Array.from(this.assignments.entries())
                             .sort((a, b) => {
                               const pathA = a[0];
                               const pathB = b[0];

                               const dotsA = (pathA.match(/\./g) || []).length;
                               const dotsB = (pathB.match(/\./g) || []).length;

                               if (dotsA !== dotsB) return dotsA - dotsB;

                               const schemaA = this.schema.find(pathA);
                               const schemaB = this.schema.find(pathB);

                               if (schemaA && !schemaB) return -1;
                               if (!schemaA && schemaB) return 1;

                               if (schemaA && schemaB) {
                                 const priorityA = schemaA.isSelector || !!schemaA.options.staged?.length;
                                 const priorityB = schemaB.isSelector || !!schemaB.options.staged?.length;

                                 if (priorityA && !priorityB) return -1;
                                 if (!priorityA && priorityB) return 1;
                               }
                               if (pathA.indexOf(':') === -1 && pathB.indexOf(':') >= 0) {
                                 return -1;
                               }
                               if (pathA.indexOf(':') >= 0 && pathB.indexOf(':') === -1) {
                                 return 1;
                               }

                               return pathA.localeCompare(pathB, undefined, { numeric: true });
                             })

  }

  containerAssignmentsComplete(path) {
    for (const assignmentPath of this.assignments.keys()) {
      if (path === '' && assignmentPath !== '') {
        return false;  // if we're checking the root, then any keys at all mean we're not done
      }
      if (assignmentPath.startsWith(`${path}.`) || assignmentPath.startsWith(`${path}:`)) {
        return false;
      }
    }
    return true;
  }


  findUnresolvedUnion(path) {
    while (true) {
      const schema = this.schema.find(path);

      if (!schema) {
        return null;
      }
      if (schema.isUnion && !this.resolvedSchemas.get(path)) {
        return path;
      }
      const dot = path.lastIndexOf('.');

      if (dot === -1) {
        return null;
      }
      path = path.slice(0, dot);
    }
  }

  getStatus(path) {
    let status = this.pathStatus.get(path);
    if (!status) {
      status = new AssignmentStatus(path);
      this.pathStatus.set(path, status);
    }
    return status;
  }

  setCompleted(path, completed = true) {
    this.getStatus(path).completed = completed;
    if (completed) {
      this.counter++;
      this.assignments.delete(path);
    }
  }
  isCompleted(path) {
    return this.getStatus(path).completed ?? false;
  }

  /**
   * @param {string} path
   * @returns {{key: string, schema: CompiledSchema}|undefined}
   */
  getResolvedSchema(path) {
    return this.resolvedSchemas.get(path);
  }

  /**
   * @param {string} path
   * @param {string} key
   * @param {CompiledSchema} schema
   *
   * @returns {{key:string,schema:CompiledSchema}}
   */
  setResolvedSchema(path, key, schema) {
    if (this.getResolvedSchema(path)?.schema !== schema) {
      this.counter++;
      this.resolvedSchemas.set(path, {key, schema});
      this.final = false;
    }
    return {key, schema};
  }

  setCondition(path, value) {
    this.conditions.set(path, value);
  }

  getCondition(path) {
    return this.conditions.get(path) ?? false;
  }

  setRequired(path, value = true) {
    this.required.set(path, value);
  }
  isRequired(path) {
    return this.required.get(path) ?? false;
  }

  getStagedData(path) {
    return this.staged.get(path);
  }

  saveStagedData(path, value) {
    const currentValue = this.staged.get(path);

    if (value !== currentValue) {
      this.counter++;
      if (value === undefined) {
        this.staged.delete(path)
        if (this.assignments.get(path) === CompiledSchema.__STAGED) {
          this.assignments.delete(path);
        }
      }
      else {
        if (typeof value !== 'object') {
          throw new SchemaError('Can only stage objects')
        }

        this.staged.set(path, value);
      }
    }
    return value;
  }
  clearStagedData(path) {
    const currentValue = this.getStagedData(path);
    this.saveStagedData(path, undefined);
    return currentValue;
  }
}

