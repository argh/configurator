import { SchemaError, ValidationError } from '../errors.js';
import { isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';

/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueFunction, AsyncSchemaValueFunction } from './types.js' */

/** @typedef {import('./types.js').ISchemaMetadata} CompiledSchemaMetadata */

/** @typedef {ISchemaOptions & {
 *              normalizer?: SchemaValueFunction<any>,
 *              transformer?: AsyncSchemaValueFunction<any>,
 *              validator?: AsyncSchemaValueFunction<any>,
 *              serializer?: AsyncSchemaValueFunction<any>,
 *              condition?: AsyncSchemaValueFunction<boolean>,
 *              discriminator?: AsyncSchemaValueFunction<CompiledSchema>
 * }} CompiledSchemaOptions
 */


/** @typedef {Object.<string, CompiledSchema>} CompiledSchemaProperties */
/** @typedef {Object.<NonNullable<any>, CompiledSchema>} CompiledSchemaUnionSchemas */

/**
 * @class
 * @typedef {import("./types.js").ISchema} ISchema
 * @implements ISchema
 */
export class CompiledSchema
{
  static __TOKEN = Symbol('CONSTRUCT_USING_RESOLVER')

  /**
   * CompiledSchema constructor - do not call directly (use SchemaResolver.compile())
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

    /** @type {CompiledSchemaOptions} */
    this._options = {};

    /** @type {CompiledSchemaMetadata} */
    this._metadata = {};

    /** @type {CompiledSchemaUnionSchemas} */
    this._unionSchemas = {};
  }

  get name() {
    return this._name;
  }

  get parent() {
    return this._parent; // overridden just for type narrowing
  }

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
      return this._options.selection? this.name : undefined;
    }
  }


  /**
   * validator - returns a function that ensures a value meets the schema definition
   * @returns {AsyncSchemaValueFunction<any>}
   */
  get xxvalidator() {
    if (typeof this._options.validator !== 'function') {
      throw new SchemaError('Unresolved schema validator');
    }
    return this._options.validator;
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
   * processAssignments - convert a map of assignments into an output object based on the schema
   *
   * @param {Map<string,NonNullable<any>>} assignments - path-to-value pairs
   * @param {any} [result] - optional object or array defining the output (if set, needs to match the schema!)
   * @param {{strict?: boolean}} [options] - optional assignment options
   * @returns {Promise<any>} - returns validated result
   */
  async processAssignments(assignments, result, options) {

    if (!result) {
      // by convention, container transformers should create an empty default shape when passed true
      result = await this.transform(true, {}, '', {...options});
    }
    const strict = this.strict ?? options?.strict ?? true;
    const progress = new AssignmentProgress(this, assignments, strict);

    let done = false;
    //let final = false;

    progress.final = false;


    while (!done) {
      let beforeSize = progress.remainingAssignmentCount;

      for (let [path, value] of progress.remainingAssignments) {
        if (progress.isCompleted(path)) {
          continue;
        }
        try {
          const processedValue = await this._processAssignment(path, value, result, progress);
          if (processedValue !== undefined) {
            progress.setCompleted(path);
          }
          else if (progress.final && (!progress.getCondition(path) /*|| !progress.isRequired(path)*/)) {
            progress.setCompleted(path);
          }
          else if (progress.final) {
            const unresolvedUnion = progress.findUnresolvedUnion(path);
            if (unresolvedUnion) {
              throw new ValidationError(`Failed to process "${path}" (unable to uniquely resolve "${unresolvedUnion}")`)
            }
          }
        }
        catch (error) {
          throw new SchemaError(`Error assigning ${path}`, {cause: error});
        }
      }
      let afterSize = progress.remainingAssignmentCount;
      if (afterSize === 0 || afterSize === beforeSize) {
        if (progress.final) {
          done = true;
        }
        else {
          progress.final = true;  // do one final cleanup pass
        }
      }
    }

    if (strict && progress.remainingAssignmentCount > 0) {
      throw new ValidationError(`Failed to assign ${progress.remainingAssignmentCount > 1 ? 'properties' : 'property'}: ${Array.from(progress.assignments.keys()).join(', ')}`);
    }

    return await this.validate(result, {strict, populateDefaults: true}) ?? {};  // FIXME
  }


  /**
   * _processAssignment - go through the assignment pipeline for a single value
   * @param {string} path - path to assign
   * @param {NonNullable<any>} value - value to assign
   * @param {Object|Array<any>} result - aggregated full result (some schema functions peek at full output to drive behavior)
   * @param {AssignmentProgress} progress - cache of assignment state
   * @returns {Promise<undefined|any>} - assigned value, or undefined if it can't be assigned right now (may be retried later)
   * @private
   */
  async _processAssignment(path, value, result, progress) {
    let unionCache = false;
//    const parts = path.split('.').map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
    const parts = path.split('.');
    let currentPath = '';

    /** @type {CompiledSchema|undefined} */
    let currentSchema = this;
    let current = result;

    // Walk down the path
    for (let i = 0; i < parts.length; i++) {
      /** @type {string|number} */
      let part = parts[i];

      let key;
      let p = part.split(':');
      if (p.length > 1) {
        part = p[0]
        key = p[1];
      }
      if (/^\d+$/.test(part)) {
        part = parseInt(part, 10);
      }

      const isLastPart = i === parts.length - 1;

      currentPath = currentPath ? `${currentPath}.${part}` : `${part}`;

      const parentSchema = currentSchema;
      currentSchema = parentSchema.getPropertySchema(`${part}`);

      // If we don't have a schema for this part of the path, we can't handle the
      // assignment.  (This may be because it's for an unresolved union member!)
      if (!currentSchema) {
        if (!unionCache && progress.strict) {
          throw new ValidationError(`Unknown property "${currentPath}"`);
        }
        return undefined;
      }

      //
      // Stage 1 - Get the schema for the current part
      //

      if (isLastPart) {
        if (typeof value === 'function' && !isConstructor(value)) {
          // if value is a function, it must act like an AsyncSchemaValueFunction
          value = await value(value, result, this, path);
        }
        if (value === undefined) {
          return undefined;
        }
        value = currentSchema.normalize(value, result, path);

        if (value === undefined) {
          return undefined;
        }
        if (currentSchema.hasChildren) {
          // When we're on the final part of the path but still pointing at a container,
          // we attempt to convert the (presumably parsed) value to individual child assignments.
          // (Note: we handle low-priority container assignment vs. high-priority individual assignments
          // by sorting the assignments by path depth on each pass.)
          const assignments = currentSchema.toAssignments(value, path);

          progress.addAssignments(assignments);

          // The individual assignments we just created will drive container creation
          // on a subsequent pass through the assignment loop, so we're done with this path now.
          progress.setCompleted(path);
          return undefined;
        }
        if (currentSchema.isUnion) {
          // We are at the last part, but the current schema is an unresolved union
          // that does not have children.  This is a weird case, why bother defining
          // a union rather than just a single custom type?  We'll do our best to
          // try to resolve it via the value passed (or the overall configuration?)
          // but it seems pretty unlikely that this is a real case.
          // todo - figure out a unit test to exercise this
          /** @type {CompiledSchema|undefined} */
          const unionSchema = await currentSchema.discriminateUnion(value, result, path);

          if (unionSchema) {
// todo - also check if there's an actual key?
// disable the following code because we're not going to use the resolved schema for anything
//            const unionKey = currentSchema.findUnionKey(unionSchema);
//            progress.setResolvedSchema(currentPath, unionKey, unionSchema);
            currentSchema = unionSchema;
          }
          else {
            return undefined;
          }
        }
      }
      else {
        // !isLastPart

        if (currentSchema.isUnion) {
          // Have we already resolved this?

          const resolved = progress.getResolvedSchema(currentPath);

          if (resolved) {
            if (key && resolved.key !== key) {  // this assignment isn't for this union
              progress.setCompleted(path);      // clear out irrelevant assignments (always ignored)
              return undefined;
            }
            currentSchema = resolved.schema;
          }
          else {
            // Do we have a cached container holding our work-in-progress?
            let wip = progress.getValue(currentPath);
            /** @type {CompiledSchema|undefined} */
            const unionSchema = wip !== undefined ? await currentSchema.discriminateUnion(wip, result, currentPath,
              {resolveUnions: progress.final}) : undefined;

            if (unionSchema) {
              // If we're here, we were able to use the cache to discriminate the union.
              // Mark this union as resolved, and convert the cache to assignments.
              // (Do we actually need to do this, or are they still in the main
              // assignments list and repeatedly assigned as they're "failing"?)
              const unionKey = currentSchema.findUnionKey(unionSchema);
              if (unionKey === undefined) {
                throw new SchemaError('Unable to identify key for discriminated union schema!')
              }
              progress.setResolvedSchema(currentPath, unionKey, unionSchema);
              currentSchema = unionSchema;
              const assignments = currentSchema.toAssignments(wip, currentPath);
              progress.addAssignments(assignments);
              // Clear the cache
              progress.setValue(currentPath, undefined);
              unionCache = false;

              // Just because we resolved the union from the WIP cache doesn't mean that the assignment is relevant!
              if (key && unionKey !== key) {  // this assignment isn't for this union
                progress.setCompleted(path);  // clear out irrelevant assignments (always ignored)
                return undefined;
              }

            }
            else {
              // We haven't been able to resolve the union yet.
              // If this assignment is targeting a specific resolved union member,
              // then we need to skip it.
              if (key) {
                return undefined;
              }
              // If we have a cached container, set up Phase 3 below to use it.
              // (Phase 3 will be reading or creating the appropriate container
              // type for the schema found in Phase 1.)
              //
              // The current value pointer would normally still be at the parent
              // container at this point, so we need to replace current with a new
              // "fake" parent that contains our cache container.
              if (wip !== undefined) {
                unionCache = true;
                current = {[part]: wip};
              }
              // otherwise, fall through and let the cache container be created below
            }
          }
        }
      }

      // Phase 2 - we've decided what schema to use; check condition and save off
      // any relevant info.

      // Conditions will get re-checked multiple times if they fail, as it is possible they may change
      // value based on updates to configuration state.  Once the configuration has stabilized, we
      // will remove any remaining assignments that failed their condition check.
      //
      // (Note: we don't retroactively reconsider conditional assignments that were previously resolved.
      // This seemed like a reasonable constraint on conditionals in order to avoid the possibility
      // of flapping assignments.  It also seemed unlikely that any real-world scenarios would require
      // that kind of behavior.)

      if (!progress.getCondition(currentPath)) {
        const condition = await currentSchema.checkCondition(value, result, currentSchema, currentPath);
        progress.setCondition(currentPath, condition);
        if (!condition) {
          return undefined;
        }
      }

      progress.setRequired(currentPath, currentSchema.required ?? false);

      //
      // Phase 3 - Deal with updating the "current" object from the assignment.
      // If we're not yet at the final part of the path, then the task is to
      // either create or retrieve the container that will be used for the rest
      // of the path.  If we are at the final part, then we are dealing with
      // the actual value assignment.  (If at any point we are dealing with a
      // union, we try to resolve it based on what we know so far.)

      if (!isLastPart) {
        if (current[part]) {
          // Not at the last part, but we already have a container
          current = current[part];
        }
        else {
          // Not at the last part, we need to create a container!

          try {
            // There's a chance this container is some wacky custom type, so transform it:
//            const processedContainer = await currentSchema.transform(rawContainer, result, currentPath);
            let processedContainer = await currentSchema.transform(true, result, currentPath);
            if (!processedContainer) {
              return undefined;
            }
            if (typeof processedContainer !== 'object') {
              // Something weird happened.  Try to fix it.
              processedContainer = Number.isInteger(parts[i + 1])? [] : {};
            }
            if (currentSchema.isUnion) {
              // We're not at the last part, but have not yet been able
              // to resolve the union, so child assignments are either
              // common members of the union itself (and used for the
              // discriminator), or were skipped earlier.
              //
              // We will cache these assignments off to the side to check with
              // the union discriminator on a subsequent assignment loop.
              // todo - test edge case in case "final" gets triggered early?
              unionCache = true;
              progress.setValue(currentPath, processedContainer);
              current = processedContainer;
            }
            else {
              // The "normal" path -- a regular container.
              current[part] = processedContainer;
              current = current[part];
            }
          }
          catch (error) {
            throw new SchemaError(`Unable to construct "${path}"`, {cause:error});
          }
        }
      }
      else {
        // We're at the final part of the path, so we need to deal with the value assignment
        try {
          const processedValue = await currentSchema.transform(value, result, path);

          if (processedValue === undefined) {
            return undefined;
          }
          current[part] = processedValue;
          if (unionCache) {
            // Successfully processed the value, but it's an assignment to a
            // cached property of an unresolved union, so it will need to
            // be reprocessed. (The values in the cache may allow the union
            // to resolve on a subsequent pass through the assignment loop.)
            return undefined;
          }

          // Otherwise, this was a successful assignment, so it's done!
          progress.setCompleted(path);
          return processedValue;
        }
        catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }
          throw new SchemaError(`Unable to assign "${path}"`, {cause: error});
        }
      }
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
   * @returns {any}
   */
  normalize(value, configuration = {}, path = this.path) {
    const normalizer = this._options.normalizer;
    if (typeof normalizer !== 'function') {
      throw new SchemaError('Unresolved schema normalizer')
    }
    return normalizer(value, configuration, this, path);
  }

  /**
   * transform - transform an input value based on this schema and provided context
   * @param {any} value - input value to transform
   * @param {any} configuration - global configuration in case the transformer depends on it
   * @param {string} path - the path to this value in the global configuration (caller will set)
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async transform(value, configuration = {}, path, options) {
    if (value !== null && this.values && this.values.length > 0) {
      // if we have children, we can't compare the value yet, we'll have to wait for validation.
      if (!this.hasChildren && !this.values.includes(value)) {
        throw new ValidationError(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`);
      }
    }
    const transformer = this._options.transformer;
    if (typeof transformer !== 'function') {
      throw new SchemaError('Unresolved schema transformer')
    }

    return transformer(value, configuration, this, path, {...options});
  }

  /**
   * validate - ensure that an object matches the schema
   * @param {any} input - input value to validate
   * @param {Object} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(input, options) {
    if (input === undefined) {
      throw new ValidationError(`Validation failed - input is undefined`)
    }
    try {
      return await this.visit(input, async (current, input, schema, path) => {

        /** @type {AsyncSchemaValueFunction<any>} */
        const validator = schema.options.validator;
        if (typeof validator !== 'function') {
          throw new ValidationError(`Invalid validator for ${path}`)
        }
        try {
          return await validator(current, input, schema, path, options);
        }
        catch (error) {
          throw new ValidationError(`Error validating ${path}`, {cause:error})
        }
      }, {...options})
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
   * @param {{all?:boolean}} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(config, options) {

//    const all = options?.all ?? false;  // todo - handle

    return this.visit(config, async (value, configuration, schema, path, options) => {
      if (schema.metadata.omitFromSerialize) {
        return EMPTY_VALUE;
      }
      else {
        const serializer = schema.options.serializer;

        if (!serializer || typeof serializer !== 'function') {
          throw new SchemaError('Serializer is not a function');
        }

        return serializer(value, configuration, schema, path, options);
      }
    }, options);
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
      return undefined;
    }

    const discriminator = this._options.discriminator;

    if (!this.isUnion || !discriminator) {
      return undefined;
    }
    if (typeof discriminator !== 'function') {
      throw new SchemaError('Unresolved discriminator')
    }
    return discriminator(value, configuration, this, path, options);
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
      s = s?.properties[pathComponent];

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
   * toAssignmentsOld - attempt to convert an input to a map of assignments
   * @deprecated
   * @param {any} object - input
   * @param {string} prefix - prefix to add to any path generated
   * @returns {Map<string, any>} - output map of path-to-value associations
   */
  toAssignmentsOld(object, prefix = '') {
    const assignments = new Map();

    function walk(current, path) {
      const isContainer = Array.isArray(current) || isPlainObject(current);

      if (isContainer) {
        const entries = Array.isArray(current)? current.entries() : Object.entries(current);

        for (const [key, value] of entries) {
          walk(value, path ? `${path}.${key}` : `${key}`)
        }
      }
      else if (path) {
        assignments.set(path, current);
      }
    }
    walk(object, prefix);
    return assignments;
  }

  /**
   * toAssignments - attempt to convert an input to a map of assignments
   * @param {any} object - input
   * @param {string} prefix - prefix to add to any path generated
   * @returns {Map<string, any>} - output map of path-to-value associations
   */
  toAssignments(object, prefix = '') {
    const assignments = new Map();

    function walk(schema, current, path) {
      const isContainer = Array.isArray(current) || isPlainObject(current);

      if (isContainer && schema?.hasChildren) {
        const entries = Array.isArray(current)? current.entries() : Object.entries(current);

        for (const [key, value] of entries) {
          const propertySchema = schema?.getPropertySchema(key);
          walk(propertySchema, value, path ? `${path}.${key}` : `${key}`)
        }
      }
      else if (path) {
        assignments.set(path, current);
      }
    }
    walk(this, object, prefix);
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
   * @param {SchemaValueFunction<any>} visitor - async visitor
   * @param {Object} [options] - options to pass to visitor
   * @returns {Promise<any>} - returns result of visitor call on outermost schema
   */
  async visit(input, visitor, options) {

    const resolveUnions = options?.resolveUnions ?? true; // true = enforce that unions resolve
    const enforceRequired = options?.enforceRequired ?? true;     // true = enforce presence of required values
    const populateDefaults = options?.populateDefaults ?? false;  // todo - pretend defaults were set
    const visitDefaults = populateDefaults || (options?.defaults ?? true);     // true means visit even if value matches schema defaults


    const visited = new WeakMap(); // tracks object -> output mapping

    /**
     *
     * @param {CompiledSchema} schema
     * @param {any} current
     * @param {string} path
     * @returns {Promise<any|symbol>}
     */
    async function walk(schema, current, path) {

      const strict = schema.strict ?? options?.strict ?? true;         // true = require that input is clean

      // todo - deal with "allowEmpty" ?

      const condition = await schema.checkCondition(current, input, schema, path);
      if (!condition) {
        return EMPTY_VALUE;
      }

      if (!schema.hasChildren) {

        if (schema.default && (current === schema.default) && !visitDefaults) {
          return EMPTY_VALUE;
        }

        return visitor(current, input, schema, path) ?? current;
      }

      if (visited.has(current)) {
        return visited.get(current);
      }

      let ret;

      if (schema.isUnion && resolveUnions) {
        /** @type {CompiledSchema|undefined} */
        const unionSchema = await schema.discriminateUnion(current, input, path, {resolveUnions, enforceRequired, strict});
        if (unionSchema) {
          schema = unionSchema;
        }
        else {
          if (true || (schema.required && enforceRequired)) {
            throw new ValidationError(`Unable to discriminate union for "${path}"`)
          }
          return EMPTY_VALUE;
        }
      }

      // First, walk the actual object and validate that all members are known
      if (Array.isArray(current)) {
        ret = [];
        visited.set(current, ret);
        for (let i = 0; i < current.length; ++i) {
          const propertyName = `${i}`;
          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
          const propertySchema = schema.getPropertySchema(propertyName);
          const propertyValue = current[i];

          if (propertyValue === undefined) {
            continue;  // skip sparse array members for now
          }

          if (propertySchema) {
            const r = await walk(propertySchema, propertyValue, propertyPath) ?? propertyValue;
            if (r !== EMPTY_VALUE) {
              ret[i] = r;
            }
          }
          else if (strict) {
            throw new ValidationError(`Unexpected array index at "${propertyPath}"`)
          }
        }
      }
      else if (isPlainObject(current)) {
        ret = {};
        visited.set(current, ret);
        // we don't walk into derived objects, we will only verify the declared schemas
        for (let propertyName of Object.keys(current)) {
          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
          const propertyValue = current[propertyName];
          const propertySchema = schema.getPropertySchema(propertyName);

          if (propertySchema) {
            const r = await walk(propertySchema, propertyValue, propertyPath) ?? propertyValue;
            if (r !== EMPTY_VALUE) {
              ret[propertyName] = r;
            }
          }
          else if (strict) {
            throw new ValidationError(`Unexpected property at "${propertyPath}"`);
          }
          else {
            // no idea what this is, but we're not in strict mode, so allow it...
            ret[propertyName] = propertyValue;
          }
        }
      }
      else {
        // we don't re-create any other containers, we just validate their child properties below
        ret = current;
        visited.set(current, ret);
      }

      if (populateDefaults) {
        for (const propertyName in schema.properties) {
          const propertySchema = schema.properties[propertyName];
          if (propertyName === '*') {
            continue;
          }

          const propertyValue = current[propertyName];
          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
          let propertyDefault = propertySchema.default;

          if (propertyValue === undefined && propertyDefault === undefined && propertySchema.hasChildren) {
            propertyDefault = propertySchema.isArray? [] : {};
          }

          if (propertyValue === undefined && propertyDefault !== undefined) {
            let d = propertyDefault;
            if (typeof d === 'function' && !isConstructor(d)) {
              d = await d(null, ret, propertySchema, propertyPath);
            }

            const normalizedDefault = await propertySchema.normalize(d, ret, propertyPath);
            if (normalizedDefault === undefined) {
              continue;
            }
            const transformedDefault = await propertySchema.transform(d, ret, propertyPath);
            if (transformedDefault === undefined) {
              continue;
            }

            const r = await walk(propertySchema, transformedDefault, propertyPath);
            if (r !== EMPTY_VALUE) {
              ret[propertyName] = r;
            }
          }
        }
      }

      // Next, ensure that all required properties are set correctly
      if (enforceRequired) {
        for (const propertyName in schema.properties) {
          if (propertyName === '*') {
            continue;
          }
          const propertySchema = schema.properties[propertyName];
          const propertyValue = ret[propertyName];
          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;

          if (propertyValue !== undefined && (!isPlainObject(ret) && !Array.isArray(ret))) {
            // we don't care about the return value, we just want to look for missing required values...
            await walk(propertySchema, propertyValue, propertyPath);
          }
          else if (propertyValue === undefined && propertySchema.required) {
            if (await propertySchema.checkCondition(undefined, ret, propertySchema, propertyPath)) {
              throw new ValidationError(`Required property "${propertyPath}" is not set`);
            }
          }
          else if (propertyValue === undefined && propertySchema.hasChildren) {
            // forge a propertyValue just so we can check for required child properties...
            await walk(propertySchema, propertySchema.isArray? [] : {}, propertyPath);
          }
        }
      }
      if (schema.hasChildren) {
        if (ret === undefined || (schema.isArray && ret?.length === 0) || Object.keys(ret).length === 0) {
          return EMPTY_VALUE;
        }
      }
      return visitor(ret, input, schema, path) ?? ret;
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


class AssignmentStatus {
  constructor(path) {
    this.path = path;
    this.completed = false;
  }
}

class AssignmentProgress {
  constructor(rootSchema, assignments, strict = true) {
    this.schema = rootSchema;
    this.completed = new Map();
    /** @type {Map<string,{key:string,schema:CompiledSchema}>} */
    this.resolvedSchemas = new Map();
    this.conditions = new Map();
    this.required = new Map();
    this.values = new Map();
    this.strict = strict;
    this.processing = {};
    this.final = false;

    this.pathStatus = new Map();

    this.assignments = new Map([...assignments]);
  }

  addAssignments(assignments) {
    for (let [path, value] of assignments) {
      this.assignments.set(path, value);

      this.setCompleted(path, false); // reprocess!  (todo - verify this is what we want)
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
                                 const priorityA = schemaA.isSelector || !!schemaA.options.values?.length;
                                 const priorityB = schemaB.isSelector || !!schemaB.options.values?.length;

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
    if (this.getStatus(path)?.completed !== completed) {
//      this.final = false;
    }
    this.getStatus(path).completed = completed;
    if (completed) {
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
   */
  setResolvedSchema(path, key, schema) {
    if (this.getResolvedSchema(path)?.schema !== schema) {
      this.resolvedSchemas.set(path, {key, schema});
      this.final = false;
    }
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

  getValue(path) {
    return this.values.get(path);
  }

  setValue(path, value) {
    this.values.set(path, value);
  }
}

const EMPTY_VALUE = Symbol('EMPTY')