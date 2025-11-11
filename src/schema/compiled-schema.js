import { SchemaError, ValidationError } from '../errors.js';
import { isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { expandWildcards } from './helpers/wildcard.js';
import { existingAssignment } from './helpers/assignment-helpers.js';

/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueFunction, AsyncSchemaValueFunction, VisitOptions, SerializeOptions, ValidateOptions } from './types.js' */

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
   * processAssignments - convert a map of assignments into an output object based on the schema
   *
   * @param {Map<string,NonNullable<any>>} assignments - path-to-value pairs
   * @param {any} [result] - optional object or array defining the output (if set, needs to match the schema!)
   * @param {{strict?: boolean}} [options] - optional assignment options
   * @returns {Promise<any>} - returns validated result
   */
  async oldprocessAssignments(assignments, result, options) {

    if (this.options.type !== 'object' && this.options.type !== 'array' && this.options.type !== 'any') {
      // If this schema isn't a container we know we can handle, we treat "assignments" like a value.
      // (This is a silly edge case I probably shouldn't bother handling.)

      if (assignments.size === 0 && this.default !== undefined) {
        assignments.set('', this.default);
      }
      for (let [key, value] of assignments.entries()) {
        if (key) {
          throw new SchemaError(`Cannot assign "${key}" - schema is not a known container type`);
        }
        result = await this.normalize(value, {}, '', {...options});
        result = await this.transform(result, {}, '', {...options});
        result = await this.validate(result, {...options, populateDefaults: true});
      }
      return result;
    }

    let wildcards = expandWildcards(assignments);

    for (let [path, value] of Array.from(wildcards)) {
      if (existingAssignment(assignments, path)) {
        continue;
      }
      assignments.set(path, value);
    }

    for (let path of assignments.keys()) {
      if (path.includes('*')) {
        assignments.delete(path);
      }
    }

    /*
    if (assignments.size === 0) {
      let d = this.default;
      if (d !== undefined) {
        if (typeof d === 'function' && !isConstructor(d)) {
          d = await d(null, d, this, '');
        }
        d = await this.normalize(d);
        if (d !== undefined) {
          d = await this.transform(d);
        }
        if (d !== undefined) {
          d = await this.validate(d);
        }
      }
      return d;
    }

     */

    if (!result) {
      // by convention, container transformers and normalizers should create an empty default shape when passed true
      result = await this.normalize(true, {}, '', {...options});

      if (this.allowIncremental) {
        result = await this.transform(result, result, '', {...options})
      }
    }
    const strict = this.strict ?? options?.strict ?? true;
    const progress = new AssignmentProgress(this, assignments, strict);

    let done = false;
    //let final = false;

    progress.final = false;


    while (!done) {
      let beforeCounter = progress.counter;

      for (let [path, value] of progress.remainingAssignments) {
        if (progress.isCompleted(path)) {
          continue;
        }
        try {
          if (path === '') {
            result = await this.normalize(value, value, '', options);
            if (this.allowIncremental) {
              result = await this.transform(result, result, '', options);
            }
            progress.setCompleted(path);
            continue;
          }

          const processed = await this._processAssignment(path, value, result, progress);
          if (processed) {
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
          const message = path? `Error assigning "${value}" to ${path}` : `Error assigning "${value}"}`
          throw new SchemaError(message, {cause: error});
        }
      }

      for (const [stagedPath, stagedData] of progress.staged) {

        const parts = stagedPath.split('.');
        /** @type {CompiledSchema} */
        let s = this;
        let currentPath = '';
        // todo - do we ever need to deal with a union key here?

        for (let part of parts) {
          currentPath = currentPath ? `${currentPath}.${part}` : `${part}`
          let resolved = progress.getResolvedSchema(currentPath);

          s = resolved ? resolved.schema : s.getPropertySchema(part);
        }

        if (!s) {
          continue;
        }

        let stagedSchema = s;

        try {
          if (stagedSchema.isUnion) {
            const unionSchema = await stagedSchema.discriminateUnion(stagedData, result, stagedPath,
              {resolveUnions: progress.final});

            if (!unionSchema) {
              continue;
            }

            // If we're here, we were able to use the cache to discriminate the union.
            // Mark this union as resolved, and convert the cache to assignments.
            // (Do we actually need to do this, or are they still in the main
            // assignments list and repeatedly assigned as they're "failing"?)
            const unionKey = stagedSchema.findUnionKey(unionSchema);
            if (unionKey === undefined) {
              throw new SchemaError('Unable to identify key for discriminated union schema!')
            }
            progress.setResolvedSchema(stagedPath, unionKey, unionSchema);
            stagedSchema = unionSchema;
          }

          if (stagedSchema.allowIncremental) {
            const assignments = stagedSchema.toAssignments(stagedData, stagedPath);
            progress.addAssignments(assignments);
            progress.saveStagedData(stagedPath, undefined);  // clear the cache
          }
          else if (progress.containerAssignmentsComplete(stagedPath)) {
            progress.addAssignment(stagedPath, stagedData);
            progress.saveStagedData(stagedPath, undefined);
          }
        }
        catch (error) {
          throw new SchemaError(`Error assigning ${stagedPath}`, {cause: error})
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

    if (!this.allowIncremental) {
      result = await this.transform(result, result, '', {...options})
    }

    return await this.validate(result, {strict, populateDefaults: true});
  }


  /**
   *
   * @param assignments
   * @param result
   * @param options
   * @returns {Promise<any>}
   */
  async processAssignments(assignments, result, options) {

    let wildcards = expandWildcards(assignments);

    for (let [path, value] of Array.from(wildcards)) {
      if (existingAssignment(assignments, path)) {
        continue;
      }
      assignments.set(path, value);
    }

    for (let path of assignments.keys()) {
      if (path.includes('*')) {
        assignments.delete(path);
      }
    }

    const strict = this.strict ?? options?.strict ?? true;
    const progress = new AssignmentProgress(this, assignments, strict);

    let done = false;
    //let final = false;

    progress.final = false;


    while (!done) {
      let beforeCounter = progress.counter;

      for (let [path, value] of progress.remainingAssignments) {
        if (progress.isCompleted(path)) {
          continue;
        }
        try {
          let previous = result;
          result = await this._newProcessAssignment(progress, result, path, value, '', result, path);

          if (result === CompiledSchema.__IGNORE) {
            progress.setCompleted(path);
            result = previous;
          }

          if (previous !== undefined && previous !== null && result !== previous) {
            throw new SchemaError('somehow lost our result');
          }
        }
        catch (error) {
          const message = path ? `Assignment error for ${path}` : 'Assignment error'
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

    return await this.validate(result, {strict, populateDefaults: true});
  }



  // consider renaming? (return value is the top level schema, not the deep schema)
  //

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
  async _newProcessAssignment(progress, result, assignmentPath, assignmentValue, currentPath, currentValue, remainingPath) {

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

    if (propertyName !== '') {
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
          const message = currentPath ? `Unknown property "${propertyName}" at ${currentPath}` : `Unknown property "${propertyName}"`;
          throw new ValidationError(message);
        }
        return staged? originalCurrentValue : currentValue;
      }

      if (propertySchema.implicit) {
        return CompiledSchema.__IGNORE;
      }

      const propertyPath = currentPath ? `${currentPath}.${segment}` : segment;
      propertyCurrentValue = currentValue?.[propertyName];
      propertyValue = await propertySchema?._newProcessAssignment(progress, result, assignmentPath, assignmentValue, propertyPath, propertyCurrentValue, nextRemainingPath);

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
      // if value is a function, it must act like an AsyncSchemaValueFunction that returns the actual value
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

    if (propertyValue !== undefined && (propertyValue !== propertyCurrentValue)) {
      if (!returnValue || typeof returnValue !== 'object') {
        const schemaName = currentSchema.path || 'root'
        throw new SchemaError(`Current ${typeof returnValue} value at ${schemaName} cannot accept assignment to "${propertyName}"`)
      }
      if (/^\d+$/.test(propertyName)) {
        const propertyIndex = parseInt(propertyName);
        returnValue[propertyIndex] = propertyValue;
      }
      else {
        returnValue[propertyName] = propertyValue;
      }
      if (propertyName === '') {
        progress.setCompleted(assignmentPath);
        throw new Error('wut');  //fixme

      }
    }

    if (staged) {
      if (!currentSchema.isUnion && (currentSchema.allowIncremental || progress.containerAssignmentsComplete(currentPath))) {
        // unstage!  todo - check if it's not a container (allowIncremental is off for those?)
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
   * _processAssignment - go through the assignment pipeline for a single value
   * @param {string} path - path to assign
   * @param {NonNullable<any>} value - value to assign
   * @param {Object|Array<any>} result - aggregated full result (some schema functions peek at full output to drive behavior)
   * @param {AssignmentProgress} progress - cache of assignment state
   * @returns {Promise<boolean>} - assigned value, or undefined if it can't be assigned right now (may be retried later)
   * @private
   */
  async _processAssignment(path, value, result, progress) {
    let isStaged = false;
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
        if (!isStaged && progress.strict) {
          throw new ValidationError(`Unknown property "${currentPath}"`);
        }
        return false;
      }

      //
      // Stage 1 - Get the schema for the current part
      //

      if (isLastPart) {
        if (typeof value === 'function' && !isConstructor(value)) {
          // if value is a function, it must act like an AsyncSchemaValueFunction that returns the actual value
          // todo - add option to allow setting the value to a function without calling it
          value = await value(value, result, this, path);
        }
        if (value === undefined) {
          return false;
        }
        value = currentSchema.normalize(value, result, path);

        if (value === undefined) {
          return false;
        }

        if (currentSchema.hasChildren && currentSchema.allowIncremental) {
          if (typeof value === 'object' && Object.keys(value).length > 0) {
            // When we're on the final part of the path but still pointing at a container,
            // we attempt to convert the (presumably parsed) value to individual child assignments.
            const assignments = currentSchema.toAssignments(value, path);

            progress.addAssignments(assignments);

            // The individual assignments we just created will drive container creation
            // on a subsequent pass through the assignment loop, so we're done with this path now.
            return true;
          }
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
            return false;
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
              return true;
            }
            currentSchema = resolved.schema;

            if (!currentSchema.allowIncremental) {
              let staged = progress.getStagedData(currentPath);

              if (staged) {
                isStaged = true;
                current = {[part]: staged};
              }
            }

          }
          else {
            let staged = progress.getStagedData(currentPath);

            if (key) {
              return false;
            }

            if (staged) {
              isStaged = true;
              current = {[part]: staged};
            }
          }
        }
        else {
          // Not a union...
          if (!currentSchema.allowIncremental) {
            const staged = progress.getStagedData(currentPath);

            if (staged !== undefined) {
              isStaged = true;
              current = {[part]: staged}
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
          return false;
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
            let processedContainer = await currentSchema.normalize(true, result, currentPath);
            if (!processedContainer) {
              return false;
            }
            if (currentSchema.allowIncremental) {
              // There's a chance this container is some wacky custom type, so transform it:
              processedContainer = await currentSchema.transform(processedContainer, result, currentPath);
              if (!processedContainer) {
                return false;
              }
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
              // We will stage these assignments off to the side to check with
              // the union discriminator on a subsequent assignment loop.
              // todo - test edge case in case "final" gets triggered early?
              // todo - union inside a union gets a separate cache (is this ok?)
              isStaged = true;
              progress.saveStagedData(currentPath, processedContainer);
              current = processedContainer;
            }
            else if (!currentSchema.allowIncremental) {
              // This container wants to transform its value all at once
              isStaged = true;
              progress.saveStagedData(currentPath, processedContainer);
              current = processedContainer;
            }
            else {
              // The "normal" path -- a regular "object-like" container.
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
            return false;
          }

          if (isStaged) {
            current[part] = processedValue;
            // Successfully processed the value, but it's an assignment to a
            // staged property of an unresolved union, so it will need to
            // be reprocessed.  (The staged data may allow the union to
            // resolve on a subsequent pass through the assignment loop.)
            //return undefined;
            return true;
          }
          else if (!currentSchema.options.implicit) {
            current[part] = processedValue;
          }

          // Otherwise, this was a successful assignment, so it's done!
          return true;
        }
        catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }
          throw new SchemaError(`Unable to assign "${path}"`, {cause: error});
        }
      }
    }
    throw new Error('wut')
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
    return normalizer(value, configuration, this, path, options);
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
    if (value !== null && this.values && this.values.length > 0) {
      // if we have children, we can't compare the value yet, we'll have to wait for validation.
      if (!this.hasChildren && !this.values.includes(value)) {
        const isContainerInit = (value === true && (this.options.type === 'object' || this.options.type === 'array'))
        const strict = this.strict ?? options?.strict ?? true;
        if (!isContainerInit && strict) {
          throw new ValidationError(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`);
        }
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
   * @param {ValidateOptions} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(input, options) {
    if (input === undefined) {
//FIXME      throw new ValidationError(`Validation failed - input is undefined`)
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
          const message = path ? `Error validating ${path}`: 'Validation error';
          throw new ValidationError(message, {cause:error})
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
   * @param {SerializeOptions} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(config, options = {}) {
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
    }, {enforceRequired: false, populateDefaults: false, ...options});
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
      throw new SchemaError('Unresolved discriminator')
    }
    let unionSchema = await discriminator(value, configuration, this, path, options);

    if (!unionSchema) {
      return undefined;
    }
    if (typeof unionSchema === 'string' && this.unionSchemas[unionSchema]) {
      unionSchema = this.unionSchemas[unionSchema];
    }
    if (!(unionSchema instanceof CompiledSchema)) {
      throw new SchemaError(`Union discriminator returned unexpected value`)
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
   * @param {VisitOptions} [options] - options to pass to visitor
   * @returns {Promise<any>} - returns result of visitor call on outermost schema
   */
  async visit(input, visitor, options) {

    const resolveUnions = options?.resolveUnions ?? true;
    const enforceRequired = options?.enforceRequired ?? true;
    const populateDefaults = options?.populateDefaults ?? false;
    const visitDefaults = populateDefaults || (options?.visitDefaults ?? true);

    const visited = new Map(); // tracks object -> output mapping

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

      if (schema.options.implicit) {
        return current;
      }

      if (!schema.hasChildren && !schema.isUnion) {

        if (schema.default && (current === schema.default) && !visitDefaults) {
          return EMPTY_VALUE;
        }

        if (current === undefined && populateDefaults && schema.default) {
          current = await schema.normalize(schema.default, input, path);
          if (current === undefined) {
            return EMPTY_VALUE;
          }
          current = await schema.transform(current, input, path);
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
        const keys = Object.keys(current).map(key => /^\d+$/.test(key)? Number(key) : key);
//        for (let i = 0; i < current.length; ++i) {
//        for (const i in current) {
        for (let key of keys) {
          const propertyName = `${key}`;
          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
          const propertySchema = schema.getPropertySchema(propertyName);
          const propertyValue = current[key];

          if (propertyValue === undefined) {
            continue;  // skip sparse array members for now
          }

          if (propertySchema) {
            const r = await walk(propertySchema, propertyValue, propertyPath) ?? propertyValue;
            if (r !== EMPTY_VALUE) {
              ret[key] = r;
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

      if (populateDefaults && schema.allowIncremental) {
        for (const propertyName in schema.properties) {
          const propertySchema = schema.properties[propertyName];
          if (propertyName === '*') {
            continue;
          }
          if (propertySchema.options.implicit) {
            continue;
          }

          const propertyValue = current?.[propertyName];
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
// fixme - pretty sure ret is not root obj here
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
              if (ret === undefined) {
                ret = await schema.normalize(true, undefined, path);
                if (ret === undefined) {
                  continue;
                }
                ret = await schema.transform(ret, undefined, path);
              }
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
          if (propertySchema.options.implicit) {
            continue;
          }
          const propertyValue = ret?.[propertyName];
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
        if (ret === undefined
            || (/*path !== '' &&*/ schema.isArray && Array.isArray(ret) && ret?.length === 0)
            || (/*path !== '' &&*/ typeof(ret) === 'object' && isPlainObject(ret) && Object.keys(ret).length === 0)
        ) {
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
    if (this.assignments.has(path)) {
      // this is ok, must be a bulk assignment!
//      return false;
    }
    for (const assignmentPath of this.assignments.keys()) {
      if (path === '' && assignmentPath !== '') {
        return false;  // if we're checking the root, then any keys at all mean we're not done
      }
      if (assignmentPath.startsWith(`${path}.`)) {  // fixme - check union key as well?
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
    if (this.getStatus(path)?.completed !== completed) {
//      this.final = false;
    }
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
