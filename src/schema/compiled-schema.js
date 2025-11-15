import { strict as assert } from 'assert';
import {
  ConstraintError,
  NormalizeError,
  SchemaError,
  SerializeError,
  TransformError,
  ValidationError
} from '../errors.js';
import { isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { expandWildcards } from './helpers/wildcard.js';
import { existingAssignment } from './helpers/assignment-helpers.js';


/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueProcessor, AsyncSchemaValueProcessor, AsyncSchemaValueVisitorFunction, AssignmentOptions, VisitOptions, SerializeOptions, ValidateOptions, PopulateOptions } from './types.js' */

/** @typedef {import('./types.js').ISchemaMetadata} CompiledSchemaMetadata */

/** @typedef {ISchemaOptions & {
 *              normalizer?: SchemaValueProcessor<any>,
 *              transformer?: AsyncSchemaValueProcessor<any>,
 *              validator?: AsyncSchemaValueProcessor<any>,
 *              serializer?: AsyncSchemaValueProcessor<any>,
 *              condition?: AsyncSchemaValueProcessor<boolean>,
 *              discriminator?: AsyncSchemaValueProcessor<CompiledSchema>
 * }} CompiledSchemaOptions
 */


/** @typedef {Object.<string, CompiledSchema>} CompiledSchemaProperties */
/** @typedef {Object.<NonNullable<any>, CompiledSchema>} CompiledSchemaUnionSchemas */

/**
 * CompiledSchema - the resolved version of a schema usable for processing configuration assignments
 *
 * The SchemaResolver compiler takes an input Schema and returns a CompiledSchema where:
 * - Developers get alerted about inconsistencies and errors.
 * - The base schema hierarchy is resolved and flattened.
 * - Core options are standardized.
 * - Unions may trigger property hoisting and discriminator synthesis.
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
   * @param {Symbol} token - magic to reduce shenanigans
   * @param {CompiledSchema|undefined} [parent] - parent schema when added as a child
   * @param {string|undefined} [name] - property name within parent when added as a child
   */
  constructor(token, parent, name) {
//    this._id = crypto.randomUUID();
    if (token !== CompiledSchema.__TOKEN) {
      throw new SchemaError('CompiledSchema must be created via compilation');
    }
    /** @type {string|undefined} */
    this._name = name;
    /** @type {CompiledSchema|undefined} */
    this._parent = parent;

    /** @type {CompiledSchemaProperties} */
    this._properties = {};

    /** @type {CompiledSchemaOptions} */
    this._options = {};

    /** @type {CompiledSchemaMetadata} */
    this._metadata = {};

    /** @type {CompiledSchemaUnionSchemas} */
    this._unionSchemas = {};
  }

  /**
   * name of parent schema property that references this schema
   * @returns {string|undefined}
   */
  get name() {
    return this._name;
  }

  /**
   * parent schema
   * @returns {CompiledSchema|undefined}
   */
  get parent() {
    return this._parent; // overridden just for type narrowing
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

  /** @type {CompiledSchemaOptions} */
  get options() {
    return this._options;
  }

  /** @type {CompiledSchemaMetadata} */
  get metadata() {
    return this._metadata;
  }

  /** @type {CompiledSchemaProperties} */
  get properties() {
    return this._properties;
  }

  /** @type {CompiledSchemaUnionSchemas} */
  get unionSchemas() {
    return this._unionSchemas;
  }

  /**
   * @returns {SchemaData|undefined}
   */
  toData() {
    return toData(this);
  }

  /**
   * hasChildren - return true if this schema has any children
   * @returns {boolean}
   */
  get hasChildren() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let _ in this._properties) {
      return true;
    }
    return false;
  }

  /**
   * Arrays sometimes need special treatment; built-in 'array' base sets this option
   * @returns {boolean}
   */
  get isArray() {
    return this._options.type === 'array';
  }

  /**
   * isUnion - return true if this schema defines any unionSchemas
   * @returns {boolean}
   */
  get isUnion() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let _ in this._unionSchemas) {
      return true;
    }
    return false;
  }


  /**
   * isSelector - return true if the schema acts as a selector
   * @returns {boolean}
   */
  get isSelector() {
    return !!this._options.selector;
  }

  /**
   * isSelection
   * @returns {boolean}
   */
  get isSelection() {
    return this._options.selection !== undefined;
  }

  /**
   * selection - get the selector value that triggers this selection, if any
   * @returns {string|undefined}
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
   * legal values for this schema, if known
   * @returns {Array<NonNullable<any>>|undefined}
   */
  get values() {
    return this._options.values;
  }

  /**
   * return true if this schema seems to be able to handle a given input value
   * @param {any} value
   * @returns {boolean}
   */
  accepts(value) {
    if (!Array.isArray(this.values)) {
      return true;
    }
    try {
      const normalizedValue = this.normalize(value);
      return this.values.includes(normalizedValue);
    }
    catch (_) {
      return false;
    }
  }

  /**
   * returns true if the value defined by this schema is required to exist in the output
   * @returns {boolean}
   */
  get required() {
    return this._options.required ?? false;
  }

  /**
   * returns true if the schema should have strict validation (undefined means use the validator call option)
   * @returns {boolean|undefined}
   */
  get strict() {
    return this._options.strict;
  }

  /**
   * the default value this schema provides if the input is undefined
   * @returns {any|undefined}
   */
  get default() {
    return this._options.default;
  }

  get inherit() {
    return this._options.inherit ?? false;
  }

  /**
   * return true if is schema defines a value that is implicit in the post-transform version
   * @returns {boolean}
   */
  get implicit() {
    return this._options.implicit ?? false;
  }

  /**
   * return true if the container allows incremental assignment to children
   * @returns {boolean}
   */

  get allowIncremental() {
    return this._options.allowIncremental ?? this.hasChildren;
  }

  /**
   * processAssignments - convert a map of assignments into a validated output based on the current schema
   *
   * Assignments are provided as a map of path-to-value pairs, where the path corresponds to the location in
   * the final output.
   *
   * Paths may be simple ("server.address") or include wildcards ("operations.*.debug") or be keyed to a
   * particular union member ("storage:redis.maxMemory") or even both ("commands.*:list.recursive").  The
   * path to this schema (the top level) is an empty string.
   *
   * It is possible for processAssignments to have no effect; either there were no assignments, or they were
   * filtered by conditionals.  In this case, the return value will reflect that nothing was done; typically
   * it will return undefined in this case, but it depends on the result parameter you provide:
   *
   * Normally, you will want to leave the result parameter undefined, so that the schema will build
   * the result for you based on this schema.
   *
   * However, if you pass an (appropriately typed) existing value in, the schema will attempt to use it to build
   * the final validated result.  For a schema with child schemas that supports incremental assignment, this means
   * that you would need to pass in a simple object or class instance or array.  It is assumed that this
   * "result" you pass in is pre-transformed; existing values in it are ignored.  This existing object will then
   * be incrementally populated by any successful assignments.
   *
   * (If this top-level schema schema defines a primitive type, or any schema without child properties, any
   * successful top-level assignment will return a new result value.  If the assignment has no effect, the original
   * result is returned.  Given the main purpose of this library is configuration, it would be silly to define a
   * value-type schema as the top level, but it's supported and tested for algorithmic consistency!)
   *
   * @param {Map<string,NonNullable<any>>} assignments - path-to-value pairs
   * @param {any} [result] - optional current value to use as the starting point for the result
   * @param {AssignmentOptions} [options] - optional assignment options
   * @returns {Promise<any>} - returns validated result
   */
  async processAssignments(assignments, result, options) {

    const doPopulateDefaults = (options?.populateDefaults !== false);
    const doValidate = (options?.validate !== false);

    // TODO - consider keeping wildcard defaults separate, and only expand relevant
    //        assignments when we actually use the wildcard schema!

    let wildcards = expandWildcards(assignments);

    for (let [path, value] of Array.from(wildcards)) {
      if (existingAssignment(assignments, path)) {
        continue;
      }
      assignments.set(path, value);
    }

    // ensure no actual wildcard path segments leak through
    for (let path of assignments.keys()) {
      if (path.includes('*')) {
        assignments.delete(path);
      }
    }

    const strict = options?.strict ?? true;
    const progress = new AssignmentProgress(this, assignments, strict);

    let done = false;

    progress.final = false;

    // Main assignment loop
    //
    // Process assignments until nothing changes, then attempt a final pass.
    // If anything is still unresolved during a final pass, it's an error.
    //
    // If a "final" pass triggers a change (e.g. unstaging staged data)
    // we clear the final flag and resume looping.

    while (!done) {
      let beforeCounter = progress.counter;

      for (let [path, value] of progress.remainingAssignments) {
        if (progress.isCompleted(path)) {
          continue;
        }
        try {
          let previous = result;
          result = await this._processAssignment(progress, result, path, value, '', result, path);

          if (result === CompiledSchema.__IGNORE) {
            progress.setCompleted(path);
            result = previous;
          }

          // Only enforce reference preservation for schemas with children (containers)
          // Value types (primitives) can be replaced since they're immutable
          if (this.hasChildren && previous !== undefined && previous !== null && result !== previous) {
            throw new SchemaError('Original input container replaced');
          }
        }
        catch (error) {
          if (error instanceof SchemaError && error?.message.includes(path)) {
            throw error;
          }
          const message = fpm('Assignment error', path);
          throw new SchemaError(message, {cause: error});
        }
      }

      let afterCounter = progress.counter;

      if (afterCounter === beforeCounter) {
        if (progress.final) {
          done = true;
        }
        else {
          progress.final = true;  // do one final cleanup pass
        }
      }
    }

    if (strict && progress.remainingAssignmentCount > 0) {
      throw new ValidationError(
        `Failed to assign ${progress.remainingAssignmentCount > 1 ? 'properties' : 'property'}: ${Array.from(
          progress.assignments.keys()).join(', ')}`);
    }

    const populated = doPopulateDefaults? await this.populateDefaults(result, options?.populateOptions) : result;
    return doValidate? await this.validate(populated, options?.validateOptions) : populated;
  }

  /**
   * Handle a deep assignment, constructing intermediate containers as warranted.
   *
   * @param {AssignmentProgress} progress - assignment state
   * @param {any} result                  - root object being built
   * @param {string} assignmentPath       - entire path to the assignment
   * @param {any} assignmentValue         - value to assign
   * @param {string} currentPath      - path to current schema in the assignment (starts at top === '')
   * @param {any} currentValue            - value corresponding to the current path, if any
   * @param {string} remainingPath        - the rest of the path below the current path
   * @returns {Promise<any|symbol>}
   * @private
   * @internal
   */
  async _processAssignment(progress, result, assignmentPath, assignmentValue, currentPath, currentValue, remainingPath) {

    /** @type {CompiledSchema} */
    let currentSchema = this;
    let staged = false;

    let dot = remainingPath.indexOf('.');

    const segment = (dot === -1) ? remainingPath : remainingPath.slice(0, dot);
    const [propertyName] = segment.split(/[.:]/, 1)
    const nextRemainingPath = (dot === -1) ? '' : remainingPath.slice(dot + 1);
    let unionKey;
    [currentPath, unionKey] = currentPath.split(':');

    const isAssignmentSchema = (propertyName === '');

    const originalCurrentValue = currentValue;
    if (currentValue === undefined || currentValue === null) {
      currentValue = progress.getStagedData(currentPath);
      if (currentValue !== undefined) {
        staged = true;
      }
    }
    if (isAssignmentSchema && assignmentValue === CompiledSchema.__STAGED) {
      assignmentValue = currentValue;
    }

    if (assignmentValue === undefined) {
      progress.setCompleted(assignmentPath);
      return staged ? originalCurrentValue : currentValue;
    }

    if (currentSchema.isUnion) {
      let resolved = progress.getResolvedSchema(currentPath);

      if (!resolved) {
        const discriminateValue = isAssignmentSchema ? assignmentValue : currentValue;
        const unionSchema = await currentSchema.discriminateUnion(discriminateValue, result, currentPath,{resolveUnions: progress.final});

        if (unionSchema) {
          const key = currentSchema.findUnionKey(unionSchema);
          if (!key) {
            throw new SchemaError('Union discriminator resolved to unknown schema');
          }
          resolved = progress.setResolvedSchema(currentPath, key, unionSchema);
        }
      }

      if (resolved) {
        if (unionKey && unionKey !== resolved.key) {
          progress.setCompleted(assignmentPath);
          return CompiledSchema.__IGNORE;  // does not match, so we will ignore this assignment
        }
        currentSchema = resolved.schema;
      }
      else {
        // not resolved, so we can't handle any assignments specific to a particular union key
        if (unionKey) {
          return originalCurrentValue;
        }
      }
    }
    const conditionValue = isAssignmentSchema ? assignmentValue : currentValue;

    if (!await currentSchema.checkCondition(conditionValue, result, currentSchema, currentPath)) {
      if (progress.final) {
        progress.setCompleted(assignmentPath);
      }
      return progress.final ? CompiledSchema.__IGNORE : undefined;
    }

    let propertyValue = undefined;
    let propertySchema = undefined;
    let propertyCurrentValue = undefined;

    if (!isAssignmentSchema) {
      assert(propertyName);

      // !isAssignmentSchema, but we're referencing propertyName, so being safe here...
      propertySchema = currentSchema.getPropertySchema(propertyName);

      if (!propertySchema) {
        if (currentSchema.isUnion) {

          if (progress.final) {
            throw new ValidationError(`Failed to process "${propertyName}" (unable to uniquely resolve "${currentPath}")`);
          }

          // we're still unresolved, so we'll just skip this assignment for now
          return originalCurrentValue;
        }
        if (progress.final && progress.strict) {
          throw new ValidationError(fpm('Unknown', currentPath, propertyName));
        }
        return staged? originalCurrentValue : currentValue;
      }

      if (propertySchema.implicit) {
        return CompiledSchema.__IGNORE;
      }

      const propertyPath = currentPath ? `${currentPath}.${segment}` : segment;
      propertyCurrentValue = currentValue?.[propertyName];
      propertyValue = await propertySchema?._processAssignment(progress, result, assignmentPath, assignmentValue, propertyPath, propertyCurrentValue, nextRemainingPath);

      if (propertyValue === CompiledSchema.__IGNORE) {
        // propagate the ignore state
        return CompiledSchema.__IGNORE;
      }

      if (propertyValue === undefined && !currentValue) {
        return originalCurrentValue;
      }
    }

    // If we are here, we need to have something instantiated for the current path
    // (either because this schema is the target, or because we have a child property to assign)

    let returnValue = currentValue;

    if (isAssignmentSchema && typeof assignmentValue === 'function' && !isConstructor(assignmentValue)) {
      // if value is a function, it must act like an AsyncSchemaValueProcessor that returns the actual value
      // todo - add option to allow setting the value to a function without calling it
      assignmentValue = await assignmentValue(currentValue, result, currentSchema, currentPath);

      if (assignmentValue === undefined) {
        return originalCurrentValue;
      }
    }

    if (isAssignmentSchema || returnValue === undefined || returnValue === null) {
      // container schema normalizers should produce an appropriate type when passed "true"
      returnValue = await currentSchema.normalize(isAssignmentSchema? assignmentValue : true, result, currentPath);

      if (returnValue === undefined || returnValue === null) {
        // unusual case...
        progress.setCompleted(assignmentPath);
        return isAssignmentSchema? CompiledSchema.__IGNORE : undefined;  // todo - think about this
      }

      if (isAssignmentSchema && currentSchema.hasChildren && currentSchema.allowIncremental) {
        if (typeof returnValue === 'object' && Object.keys(returnValue).length > 0) {
          // When we're on the final part of the path but still pointing at a container,
          // we attempt to convert the (presumably parsed) value to individual child assignments.
          const assignments = currentSchema.toAssignments(returnValue, currentPath);
          progress.addAssignments(assignments);

          // The individual assignments we just created will drive container creation
          // on a subsequent pass through the assignment loop, so we're done with this path now.
          progress.setCompleted(assignmentPath);
          return originalCurrentValue;
        }
      }

      // See if we need to treat this as a container (even if it isn't, and we got here due to a bad assignment)
      const isContainer = !isAssignmentSchema
                          || currentSchema.hasChildren
                          || currentSchema.isArray
                          || currentValue && typeof currentValue === 'object';

      let orphanedPropertyValue = false;

      if ((currentSchema.allowIncremental || !isContainer) && !currentSchema.isUnion) {
        const transformedValue = await currentSchema.transform(returnValue, result, currentPath);

        if (propertyValue !== undefined && (!transformedValue || typeof transformedValue !== 'object')) {
          orphanedPropertyValue = true;  // we have a processed property that needs to be staged
        }
        else {
          returnValue = transformedValue;
        }
      }

      if (returnValue !== undefined && returnValue !== null
          && (orphanedPropertyValue || currentSchema.isUnion || (isContainer && !currentSchema.allowIncremental))) {
        // stage this data and add a magic assignment so we remember to try to resolve it
        progress.saveStagedData(currentPath, returnValue);
        progress.addAssignment(currentPath, CompiledSchema.__STAGED);
        staged = true;
      }
    }

    if (!isAssignmentSchema && propertyValue !== undefined && (propertyValue !== propertyCurrentValue)) {
      if (!returnValue || typeof returnValue !== 'object') {
        const schemaName = currentSchema.path || 'root'
        throw new SchemaError(`Current ${typeof returnValue} value at ${schemaName} cannot accept assignment to "${propertyName}"`)
      }
      if (/^\d+$/.test(propertyName)) {
        returnValue[Number(propertyName)] = propertyValue;
      }
      else {
        returnValue[propertyName] = propertyValue;
      }
    }

    if (staged) {
      if (!currentSchema.isUnion && (currentSchema.allowIncremental || progress.containerAssignmentsComplete(currentPath))) {
        // unstage!  todo - check if it's not a container (allowIncremental is false for value schemas!)
        returnValue = await currentSchema.transform(returnValue, result, currentPath);
        progress.clearStagedData(currentPath);
        staged = false;
      }
    }

    if (returnValue !== undefined) {
      if (isAssignmentSchema) {
        progress.setCompleted(assignmentPath);
      }
      return staged? originalCurrentValue : returnValue;
    }
    else {
      return undefined;
    }
  }

  /**
   * Check if the provided value passes the schema conditional check
   * @param {any} value
   * @param {any} configuration
   * @param {CompiledSchema} schema
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async checkCondition(value, configuration, schema, path) {
    if (typeof this._options.condition !== 'function') {
      throw new SchemaError('Unresolved schema condition');
    }
    const result = await this._options.condition(value, configuration, schema, path);
    return Boolean(result);
  }


  /**
   * normalize - ensure the input is of an expected shape that can be handled by this schema
   * @param {any} value
   * @param {any} [configuration]
   * @param {string} [path]
   * @param {Object} [options]
   * @returns {any}
   */
  normalize(value, configuration = {}, path = this.path, options) {
    const normalizer = this._options.normalizer;
    if (typeof normalizer !== 'function') {
      throw new SchemaError('Unresolved schema normalizer')
    }
    // todo - should we allow async value functions (and thus make normalize async)?  or should we move this call out of normalize?
    if (typeof value === 'function' && !isConstructor(value) && this.options.type !== 'function') {
      try {
        value = value(true, configuration, this, path, options);
      }
      catch (error) {
        throw new NormalizeError(fpm('Exception calling value function', path), {cause: error});
      }
    }

    try {
      const normalized = normalizer(value, configuration, this, path, options);

      if (typeof normalized?.then === 'function') {
        throw new SchemaError('Cannot use asynchronous value processors during normalization');
      }

      return normalized;
    }
    catch (error) {
      throw new NormalizeError(fpm('Could not normalize', path), {cause: error});
    }
  }

  /**
   * transform - transform an input value based on this schema and provided context
   * @param {any} value - input value to transform
   * @param {any} configuration - global configuration in case the transformer depends on it
   * @param {string} path - the path to this value in the global configuration (caller will set)
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async transform(value, configuration = {}, path = this.path, options) {
    try {
      if (value !== null && this.values && this.values.length > 0) {
        // if we have children, we can't compare the value yet, we'll have to wait for validation.
        if (!this.hasChildren && !this.values.includes(value)) {
          const isContainerInit = (value === true && (this.options.type === 'object' || this.options.type === 'array'))
          const strict = this.strict ?? options?.strict ?? true;
          if (!isContainerInit && strict) {
            throw new ConstraintError(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`);
          }
        }
      }
      const transformer = this._options.transformer;
      if (typeof transformer !== 'function') {
        throw new SchemaError('Unresolved schema transformer')
      }
      return await transformer(value, configuration, this, path, {...options});
    }
    catch (error) {
      throw new TransformError(fpm('Unable to transform', path), {cause: error})
    }
  }

  /**
   * Populate defaults - by design, shallow only at this point.
   * (The option to create deep defaults is implemented by SchemaDefaultsSource).
   * @param {any} input
   * @param {VisitOptions} [options]
   * @returns {Promise<any>}
   */
  async populateDefaults(input, options) {
    return await this.visit(input, async (current, input, schema, path) => {
      if (schema !== undefined && current === undefined) {
        if (schema.default !== undefined) {
          current = await schema.normalize(schema.default, input, path);
          if (current !== undefined) {
            current = await schema.transform(current, input, path);
          }
        }
      }
      return current;
    }, {visitUndefinedShallow: true, update: true, ...options});
  }

  /**
   * validate - ensure that an object matches the schema
   * @param {any} input - input value to validate
   * @param {ValidateOptions} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(input, options = {}) {

    const strict = options.strict ?? true;

    const enforceUnionResolution = options.enforceUnionResolution ?? strict;
    const disallowUnexpected = options.disallowUnexpected ?? strict;
    const enforceRequired = options.enforceRequired ?? strict;

    try {
      return await this.visit(input, async (current, input, schema, path) => {
        if (!schema) {
          const parentSchema = this.findParent(path);

          let strictParent = parentSchema?.options.strict ?? strict;

          if (strictParent && disallowUnexpected) {
            throw new ValidationError(fpm('Unexpected value', path));
          }
          return EMPTY_VALUE;
        }

        if (schema.isUnion && enforceUnionResolution) {
          throw new ValidationError(fpm('Unable to discriminate union', path))
        }

        if (current === undefined) {
          if (enforceRequired) {
            if (schema.required && enforceRequired) {
              throw new ValidationError(fpm('Missing required value', path));
            }
          }
          return EMPTY_VALUE;
        }

        /** @type {AsyncSchemaValueProcessor<any>} */
        const validator = schema.options.validator;
        if (typeof validator !== 'function') {
          throw new ValidationError(fpm('Invalid validator', path));
        }
        try {
          return await validator(current, input, schema, path, options) ?? current;
        }
        catch (error) {
          throw new ValidationError(fpm('Validation error', path), {cause:error})
        }
      }, {resolveUnions: true, visitUndefinedShallow: true, visitUnexpected: !disallowUnexpected, visitDefaults: true, ...options})
    }
    catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      else {
        throw new ValidationError('Validation failed', {cause:error});
      }
    }
  }





  /**
   * Serialize the config data as if it were a config file.
   *
   * Attempts to convert resolved values back to an input-friendly value, first via the "serialize" schema option,
   * or alternatively by trusting that each value is either already compatible, or implements toJSON().
   *
   * @param {any} config
   * @param {SerializeOptions} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(config, options = {}) {
    return this.visit(config, async (value, configuration, schema, path, options) => {
      try {
        if (schema === undefined || schema.metadata.omitFromSerialize) {
          return EMPTY_VALUE;
        }
        else {
          const serializer = schema.options.serializer;

          if (!serializer || typeof serializer !== 'function') {
            throw new SchemaError('Invalid serializer');
          }

          return await serializer(value, configuration, schema, path, options);
        }
      }
      catch (error) {
        throw new SerializeError(`${fpm('Error serializing', path)}`);
      }
    }, {...options, extract: true});
  }

  /**
   * Use the registered discriminator to return a matching union schema
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

    const discriminator = this._options.discriminator;

    if (!this.isUnion || !discriminator) {
      return undefined;
    }
    if (typeof discriminator !== 'function') {
      throw new SchemaError(fpm('Unresolved discriminator', path));
    }
    let unionSchema = await discriminator(value, configuration, this, path, options);

    if (!unionSchema) {
      return undefined;
    }
    if (typeof unionSchema === 'string' && this.unionSchemas[unionSchema]) {
      unionSchema = this.unionSchemas[unionSchema];
    }
    if (!(unionSchema instanceof CompiledSchema)) {
      throw new SchemaError(fpm('Union discriminator returned unexpected value', path))
    }
    return unionSchema;
  }

  /**
   * @param {CompiledSchema} unionSchema
   * @returns {string|undefined}
   */

  findUnionKey(unionSchema) {
    return Object.keys(this.unionSchemas).find(key => this.unionSchemas[key] === unionSchema)
  }

  /**
   * Find the schema at a given path (supports union keys in path components)
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
      let parts = pathComponent.split(':');
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
   * Find the parent schema of a given path (which might be several levels deeper than the last known schema!)
   * @param {string} path
   * @returns {CompiledSchema|undefined}
   */
  findParent(path) {
    if (!path || path === '' || path === '.') {
      return undefined;
    }
    let dot = path.lastIndexOf('.');

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
   * toAssignments - attempt to convert an input to a map of assignments
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

  async newToAssignments(object, prefix = '') {
    if (typeof object !== 'object') {
      return new Map([['', object]]);
    }
    const assignments = new Map();

    await this.visit(object, async (current, configuration, schema, path) => {

      const isContainer = Array.isArray(current) || isPlainObject(current);
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (!isContainer && !hasChildren) {
        // We visit intermediate nodes
        assignments.set(path, current);
      }

    }, {update: false, visitUnexpected: true, visitUndefined: false, resolveUnions: false});

    return assignments;
  }

  /**
   * visitSchema - call visitor on every schema node; if visitor returns false (explicitly), abort early
   *
   * @param {(schema:CompiledSchema, path:string) => any} visitor - visitor function
   * @param {{addUnionKeys?:boolean, onlySerializable?:boolean}} [options]
   * @returns {boolean} - returns true if visitors all returned true, false if any exited early
   *
   * todo: option to call visitor with union key as part of the path?
   */
  visitSchema(visitor, options) {
    const addUnionKeys = options?.addUnionKeys ?? false;
    const onlySerializable = options?.onlySerializable ?? false;
    /**
     *
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
          let childPath = path ? `${path}.${propName}` : `${propName}`;
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

  static get EMPTY_VALUE() { return EMPTY_VALUE }






  /**
   * visit - call an async visitor function on everything in an input object based on the schema definition;
   *         if any visitors return a falsey value, return early
   *
   * @param {any} input - input object
   * @param {AsyncSchemaValueVisitorFunction} visitor - async visitor
   * @param {VisitOptions} [options] - options to pass to visitor
   * @returns {Promise<any>} - returns result of visitor call on outermost schema
   */
  async visit(input, visitor, options) {
    const resolveUnions = options?.resolveUnions ?? true;
    const visitDefaults = options?.visitDefaults ?? true;
    const visitContainers = options?.visitContainers ?? true;
    const visitUnexpected = options?.visitUnexpected ?? false;
    const visitUndefinedShallow = options?.visitUndefinedShallow ?? false;
    const visitUndefined = visitUndefinedShallow || (options?.visitUndefined ?? false);
    const update = options?.update ?? false;
    const copy = options?.copy ?? false;
    const extract = options?.extract ?? false;

    if (update && (copy || extract)) {
      throw new SchemaError('Visit option conflict: specify only copy/extract or update, not both!');
    }

    /**
     *
     * @param {CompiledSchema|undefined} schema
     * @param {any|undefined} current
     * @param {string} path
     * @returns {Promise<any|symbol>}
     */
    async function walk(schema, current, path) {
      if (schema !== undefined) {
        const condition = await schema.checkCondition(current, input, schema, path);
        if (!condition) {
          return EMPTY_VALUE;
        }

        if (!visitDefaults && schema.default !== undefined && current === schema.default) {
          return EMPTY_VALUE;
        }

        if (schema.options.implicit) {
          return current;
        }

        if (schema.isUnion && resolveUnions && current !== undefined) {
          /** @type {CompiledSchema|undefined} */
          const unionSchema = await schema.discriminateUnion(current, input, path)

          if (unionSchema) {
            schema = unionSchema;
          }
        }
      }

      let ret = (copy || extract) ? undefined : current;
      if (!schema?.hasChildren) {
        ret = current;
      }

      // Traverse children?
      if (schema !== undefined && schema.hasChildren && ((ret !== undefined) || !visitUndefinedShallow)) {
        const updateProperty = async (key, val) => {
          if ((copy || update || extract) && val !== EMPTY_VALUE && val !== undefined) {
            if (ret === undefined) {
              if (extract) {
                ret = schema.isArray? [] : {};
              }
              else {
                ret = await schema.normalize(true, input, path);

                if (ret && schema.allowIncremental) {
                  ret = await schema.transform(ret, input, path);
                }
              }
            }
            if (ret) {
              ret[key] = val;
            }
          }
          else if (update && (val === EMPTY_VALUE || val === undefined)) {
            if (ret) {
              delete ret[key];
            }
          }
        }

        /** {type {Set<string>}} */
        const visited = new Set();

        // First, walk the actual object and validate that all members are known
        // (We only walk "regular" objects; we trust the validator of transformed values.)
        if (Array.isArray(current) || isPlainObject(current)) {
          const keys = Object.keys(current).map(key => /^\d+$/.test(key) ? Number(key) : key);
          for (let key of keys) {
            const propertyName = `${key}`;
            const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
            const propertySchema = schema.getPropertySchema(propertyName);
            const propertyValue = current[key];

            visited.add(propertyPath);
            if (propertySchema === undefined && schema.options.strict && !visitUnexpected) {
              throw new ValidationError(fpm('Unexpected', path, propertyName));
            }

            if (propertyValue === undefined && !visitUndefined) {
              continue;
            }

            const r = await walk(propertySchema, propertyValue, propertyPath) ?? propertyValue;

            await updateProperty(key, r);
          }
        }
        if (visitUndefined && schema.allowIncremental && (current === undefined || Array.isArray(current) || isPlainObject(current))) {
          // Next, walk the schema and visit everything that was undefined
          for (const propertyName in schema.properties) {
            const propertySchema = schema.properties[propertyName];
            const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
            if (visited.has(propertyPath) || propertyName === '*' || propertySchema.options.implicit) {
              continue;
            }
            const key = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;

            // By definition, we've already walked anything that has a defined value
            const r = await walk(propertySchema, undefined, propertyPath);

            await updateProperty(key, r);
          }
          if ((copy || update) && ret !== undefined && !schema.allowIncremental) {
            ret = await schema.transform(ret, input, path);
          }
        }
        if (!visitContainers) {
          return current;
        }
      }
      if (ret === undefined && !visitUndefined) {
        return undefined;
      }
      return await visitor(ret, input, schema, path) ?? ret;
    }
    const ret = await walk(this, input, '');

    return (ret === EMPTY_VALUE) ? undefined : ret;
  }













  /**
   * Compute all possible schema paths (including union schema properties)
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
   * getPropertySchema - return a property schema (possibly via wildcard)
   *
   * @param {string} propertyName
   * @returns {CompiledSchema}
   */
  getPropertySchema(propertyName) {
//    if (propertyName === '') {
//      return this;
//    }
    return this.properties[propertyName] ?? this.properties['*'];
  }

  /**
   * getTagged - return all child schemas that have a particular option tag
   * @param {string} tag
   * @returns {CompiledSchema[]}
   */
  getTagged(tag) {
    const schemas = [];
    for (let propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        schemas.push(schema);
      }
    }
    return schemas;
  }

  /**
   * getFirstTagged - get the first child schema that has a particular option tag
   * @param {string} tag
   * @returns {CompiledSchema|undefined}
   */
  getFirstTagged(tag) {
    for (let propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        return schema;
      }
    }
    return undefined;
  }

  /**
   * isValidPath - return true if the path is legal within the schema (may not match a union, but does it exist at all)
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
      let propertyName = parts[index];

      if (schema.hasChildren && schema.getPropertySchema(propertyName)) {
        return check(schema.getPropertySchema(propertyName), index + 1);
      }
      else if (schema.isUnion) {
        for (let unionSchema of schema.unionSchemas) {
          if (check(unionSchema, index)) {
            return true;
          }
        }
      }
      return false;
    }
    return check(this);
  }
  _freeze() {
    for (let childSchema of Object.values(this._properties)) {
      childSchema._freeze();
    }
    Object.freeze(this._properties);
    Object.freeze(this._options);
    Object.freeze(this._metadata);
    for (let unionSchema of Object.values(this._unionSchemas)) {
      unionSchema._freeze();
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
    for (let [path, value] of assignments) {
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
      let schema = this.schema.find(path);

      if (!schema) {
        return null;
      }
      if (schema.isUnion && !this.resolvedSchemas.get(path)) {
        return path;
      }
      let dot = path.lastIndexOf('.');

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
    let currentValue = this.staged.get(path);

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
    let currentValue = this.getStagedData(path);
    this.saveStagedData(path, undefined);
    return currentValue;
  }
}

const EMPTY_VALUE = Symbol('EMPTY')

/**
 * format a path (possibly with property)
 * @param {string} message
 * @param {string} path
 * @param {string} [property]
 * @param {string} [prep]
 * @returns {string}
 */
function fpm(message, path, property, prep = 'at') {

  let m = message;

  if (property) {
    m += ` property ${property}`
  }
  if (path) {
    m += ` ${prep} ${path}`;
  }

  return m;
}

