import { CompiledSchema } from '../compiled-schema.js';
import { SchemaLocation } from '../schema-location.js';
import { TraversalContext } from './traversal-context.js';
import { deepEquals, isPlainObject, isPrimitive } from '../../utils.js';
import { SchemaError } from '../../errors.js';

export class TraversalState
{
  /**
   * @param {TraversalContext} context
   * @param {string} path
   */
  constructor(context, path) {

    // core fields:
    /** @type {TraversalContext} */
    this._context = context;

    /** @type {string} */
    this._path = path;

    /** @type {SchemaLocation|undefined} */
    this._location = context.root.absolute(path);

    /** @type {TraversalState | undefined } */
    this._parent = undefined;

    /** @type {Map<string,TraversalState>} */
    this._children = new Map();

    if (this._path === '') {
      this._name = '';
    }
    else {
      const dot = this._path.lastIndexOf('.');
      const parentPath = (dot === -1) ? '' : this._path.slice(0, dot);
      this._parent = this._context.getState(parentPath);
      this._name = (dot === -1) ? this._path : this._path.slice(dot + 1);

      this._parent._children.set(this._name, this);
      this._parent.invalidateCompletion();
    }

    // state values
    this._assignedInput = undefined;
    this._input = undefined;     // most recent input
    this._inputs = new Set();    // full set of all inputs converted to values
    this._pending = undefined;   // intermediate value
    this._value = undefined;     // final value
    this._condition = undefined;
    // explicit state flags
    this._processed = false;          // are we done with final value?
    this._mandatory = false;      // was the input explicit or implicit?
    // implicit state flags

    /** @type {string|undefined} */
    this.unionKey = undefined;

    /** @type {boolean|undefined} - cached completion status of this state and its children */
    this._completed = undefined;
  }

  get context() {
    return this._context;
  }

  get parent() {
    return this._parent;
  }

  /**
   * @param {string} relativePath
   * @returns {TraversalState}
   */
  relative(relativePath) {
    if (relativePath === '') {
      return this;
    }
    if (relativePath.charAt(0) === '^') {
      if (this.parent === undefined) {
        throw new SchemaError(`Relative traversal state path ${relativePath} is above the root`);
      }
      return this.parent.relative(relativePath.slice(1));
    }

    const propertyPath = this.path ? `${this.path}.${relativePath}` : `${relativePath}`;
    return this.context.getState(propertyPath);
  }


  get path() {
    return this._path;
  }

  get name() {
    return this._name;
  }

  /** @type {SchemaLocation|undefined} */
  get location() {
    if (this._location === undefined) {
      this._location = this.context.root.absolute(this.path);
    }
    return this._location;
  }
  set location(location) {
    if (location !== this._location) {
      this._debug('setting location', location?.path);
    }
    this._location = location;
  }

  /** @type {CompiledSchema|undefined} */
  get schema() {
    return this.location?.schema;
  }
  set schema(schema) {
    if (this.location === undefined || schema === undefined) {
      // todo - This probably would indicate a library coding error.
      //        If user code triggers this exception, file a bug!
      throw new SchemaError('Inconsistent traversal state', {location: this.location});
    }
    if (this.schema !== schema) {
      this._debug('updated schema')
      this.context.update();
    }
    this.location.schema = schema;
  }

  /** @type {boolean|undefined} */
  get condition() {
    return this._condition;
  }
  set condition(condition) {
    if (this._condition !== condition) {
      if (condition === false && this._condition === true) {
        return;  // currently disallowing changing a positive condition; todo - think about this
      }
      this._debug('updated condition', condition)
      this.context.update();
    }
    this._condition = condition;
  }

  get assignedInput() {
    return this._assignedInput;
  }
  set assignedInput(assignedInput) {
    if (deepEquals(assignedInput, this._assignedInput)) {
      return;
    }
    this._debug('updated assignedInput', assignedInput)
    this._assignedInput = assignedInput;
  }

  get input() {
    return this._input;
  }
  set input(input) {
    if (deepEquals(input, this._input)) {
      return;
    }
    this._debug('updated input', input)
    this.context.update();
    this.invalidateCompletion();

    this._input = input;

    if (this.schema === undefined) {
      // todo - what about unresolved union assignments?
      return;
    }
    if (!this.schema?.hasChildren && input !== undefined) {
      this.isMandatory = true;
    }

    if (this.schema?.hasChildren && !this.schema.isUnion) {
      const isEmpty = input === undefined
                      || input === null
                      || input === true
                      || (Array.isArray(input) && input.length === 0)
                      || (typeof input === 'object' && Object.keys(input).length === 0);
      if (!isEmpty) {
        this.isMandatory = true;
      }
    }
  }


  get pending() {
    return this._pending;
  }
  set pending(pending) {
    if (pending === null) {
      this.value = null;
      this._pending = undefined;
    }
    this._debug('updated pending')
    this._pending = pending;
  }

  get value() {
    return this._value;
  }
  set value(value) {
    // use invalidate() to deliberately set value to undefined!
    if (this._value !== undefined && value === undefined) {
      throw new SchemaError('Cannot unset value', {location: this.location});
    }

    if (this._value === value) {
      // todo - deepEquals?
      return;
    }
    if (this.isPruned) {
      // todo - This likely indicates a library coding error.
      //        If user code triggers this exception, file a bug!
      throw new SchemaError(`Cannot set value at ${this._path} - node is pruned`);
    }
    if (isPrimitive(value) && this.schema?.hasChildren && !this.schema?.isImplicit && !this.schema?.isOpaque) {
      throw new SchemaError('Container processing resulted in unexpected primitive', {value, location: this.location});
    }

    this._value = value;
    this._debug('updated value')
    this.context.update();

    if (value === undefined) {
      this.invalidateCompletion();
    }

    if (value !== undefined) {
      this._inputs.add(this.assignedInput);
    }
    if (value === null && !this.processed) {
      this.processed = true;
      this._completed = true;
    }
  }
  invalidate() {
    this._condition = undefined;
    this._value = undefined;
    this._processed = false;
    this._debug('invalidated value')
    this.context.update();
  }
  invalidateCompletion() {
    this._completed = undefined;
    if (this._parent) {
      this._parent.invalidateCompletion();
    }
  }

  // If the input came from the user (e.g. not synthesized as a mid-path container) it must be processed
  get isMandatory() {
    return this._mandatory;
  }
  set isMandatory(value) {
    if (value !== this._mandatory) {
      this._debug('setting mandatory', value);
    }

    this._mandatory = Boolean(value);
  }


  get isProcessed() {
    return this._processed;
  }
  set isProcessed(value) {
    if (value !== this._processed) {
      this._debug('setting processed', value);
    }
    if (!this.isContainer) {
      this._completed = true;  // short-circuit completion when we know its safe
    }
    this._processed = Boolean(value);
  }

  // TODO - check this weird case:
  //        1. create an opaque schema with members {x,y,z}.  z is conditional on {x,y} being defined.
  //        2. assign {x,y,z}; {x,y} will likely get finalized into the object
  //        3. the z assignment wakes up; is there a way to absorb it? or does it turn into a new {z} object?

  get isComplete() {

    if (this._completed !== undefined) {
      return this._completed;
    }

    if (this.isPruned) {
      this._completed = true;
      return true;
    }
    if (this.value === undefined) {
      // We are definitely not complete if we have no value and required/default settings imply more work to do
      if (this.schema?.required) {
        return false;
      }
      if (this.schema?.default !== undefined && (typeof this.schema.default !== 'function' || this.schema.options.dynamic === false)) {
        return false;
      }
    }
    if (this.hasIncompleteDescendents) {
      return false;
    }
    if (this.hasWorkInProgress) {
      return false;
    }
    if (this.isProcessed) {
      // Normally, isProcessed would not be enough to imply isComplete; a container that allows incremental
      // assignment may be processed before its children.  However, we've already checked hasWorkInProgress,
      // which recursively checks for incomplete children!

      this._completed = true;
      return true;
    }
    if (this.isMandatory) {
      // processing is mandatory!
      return false;
    }
    if (typeof this.assignedInput === 'function' && this.schema?.options.dynamic !== false && this.input === undefined) {
      // we have a dynamic input (default?), but it hasn't returned a value; this is ok when final

      return this.context.final;
    }
    else if (this.assignedInput !== undefined && !this._inputs.has(this.assignedInput)) {
      // the input does not seem to have been fully processed (nor discarded).
      return false;
    }

    // todo - this is an experiment; is it safe to formalize checking traversals?
    if (this.assignedInput === undefined && this.context.traversals > 0) {
      this._completed = true;
      return true;
    }

    // if we don't have an assignment and are on the final pass, we're complete.
    return (this.assignedInput === undefined && this.context.final);
  }


  get hasProcessedInput() {
//    return this.value !== undefined && this.assignedInput !== undefined && this._inputs.has(this.assignedInput);
    return this.value !== undefined && this.assignedInput !== undefined && this.input !== undefined && this._inputs.has(this.assignedInput);
  }

  get isPlaceholder() {
    if (this.schema?.default !== undefined) {
      return false;
    }
    return !this.isMandatory && /*this._path !== '' &&*/ this.value === undefined;
  }

  get isContainer() {
    return this.schema?.hasChildren ?? false;
  }

  get isPruned() {
    return this._value === null || Boolean(this._parent?.isPruned);
  }

  get isDeep() {
    return this.schema?.deep ?? this.context.deep;
  }

  get isOpaque() {
    if (this.schema === undefined) {
      return true;
    }
    return !this.isContainer || this.schema.isOpaque;
  }

  get isIncremental() {
    if (this.schema === undefined) {
      return false;
    }
    return this.isContainer && !this.schema.isOpaque;
  }

  get isStrict() {
    return this.schema?.strict ?? this.context.strict;
  }

  get isUnion() {
    return this.schema?.isUnion ?? false;
  }

  get isUnresolved() {
    return this.schema === undefined || this.schema.isUnion;
  }

  get treatAsExplicit() {
    if (this.schema === undefined) {
      return true;  // force processing so that we know about errors
    }

    if (this.schema.isImplicit) {
      return false;
    }

    return !(this.isContainer && this.isIncremental);
  }

  get hasDescendentStates() {
    if (!this.isContainer) {
      return false;
    }
    return this._children.size > 0;
  }

  get hasDescendentsToTraverse() {
    if (!this.isContainer) {
      return false;
    }

    // Check for properties in input
    const hasInputProperties = typeof this._input === 'object'
                               && this._input !== null
                               && Object.keys(this._input).length > 0;

//    const hasDefaults = Object.values(this._schema?.properties).some(childSchema => childSchema.default !== undefined);

    return this.hasDescendentStates || hasInputProperties;
  }

  get hasIncompleteDescendents() {
    if (!this.isContainer) {
      return false;
    }

    return [...this._children.values()].some(childState => !childState.isComplete);
  }
  get incompleteDescendents() {
    if (!this.isContainer) {
      return [];
    }

    const childPrefix = this.path ? `${this.path}.` : '';
    return Array.from(this._context.stateMap.values())
                .filter(childState =>
                  childState.path !== this.path &&
                  childState.path.startsWith(childPrefix) &&
                  !childState.isComplete
                );
  }

  findIncompleteChildNames(incomplete = new Set()) {
    for (const childState of this._children.values()) {
      if (!childState.isComplete) {
        incomplete.add(childState.name);
      }
    }
    return incomplete;
  }

  listIncompleteChildren() {
    return [...this._children.values()].filter(childState => !childState.isComplete).map(childState => childState.name);
  }

  listPendingChildren() {

    return [...this._children.values()].filter(childState => childState.hasWorkInProgress || childState.needsInputProcessing).map(childState => childState.name);
    /*
    const childPrefix = this.path ? `${this.path}.` : '';

    const pending = new Set([...this.context.stateMap]
      .filter(([path, state]) => (path !== this.path && path.startsWith(
        childPrefix) && (state.hasWorkInProgress || state.needsInputProcessing)))
      .map(([path]) => {
        return path.slice(childPrefix.length).split('.')[0]
      }));

    return [...pending];

     */
  }

  invalidateChildren() {
    // this is called after union resolution!

    for (const childState of this._children.values()) {
      if (childState.value !== null) {
        childState.invalidate();
      }
    }
  }

  get isEmptyPlaceholder() {
    if (!this.schema?.hasChildren) {
      // concrete schemas are never placeholders
      return false;
    }
    if (!this.isPlaceholder) {
      return false;
    }

    return !this.hasDescendentsToTraverse;
  }

  get needsInputProcessing() {
    if (this.value !== undefined) {
      return false;
    }
    return (typeof this.assignedInput !== undefined && (this.input === undefined || this.pending === undefined));
  }

  get hasWorkInProgress() {
    if (this.isPruned) {
      return false;
    }
//    if (this.hasIncompleteDescendents) {
//      return true;
//    }
    if (this.pending === undefined) {
      return false;
    }
    if (this.schema?.isImplicit) {
      return false;
    }
    if (!this.isContainer) {
      return true;
    }

    const isEmpty = (Array.isArray(this.pending) && this.pending.length === 0)
                    || (typeof this.pending === 'object' && Object.keys(this.pending).length === 0);

    if (isEmpty) {
      // The WIP is an empty array or object; if we have a processed value, that's all that matters.
      if (this.isProcessed) {
        return false;
      }
      if (this.isMandatory) {
        return true;
      }
    }
    return true;
  }


  /**
   * Retrieve all incomplete child property states
   *
   * @type {Array<TraversalState>}
   */
  get activePropertyStates() {
    if (this.schema === undefined) {
      return [];
    }
    if (this.isOpaque && this.isProcessed) {
      return [];
    }
    const propertyKeys = new Set();
    const input = this.input ?? this.assignedInput;

    // todo - block exploring input when processed + opaque?
    if (isPlainObject(input) || Array.isArray(input) || (input && this.isIncremental)) {
      Object.keys(input).forEach(key => propertyKeys.add(key));
    }

    this.findIncompleteChildNames(propertyKeys);

    if (this.isIncremental || this.value === undefined) {
      // If it is opaque and already has a value, it's too late to check the schema's properties
      for (const [propertyKey, propertySchema] of this.schema.propertyEntries) {
        if (propertyKey === '*') {
          continue;
        }
        if (this.context.final || propertySchema.required || propertySchema.default !== undefined) {
          propertyKeys.add(propertyKey);
        }
      }
    }

    const container = this.pending ?? (this.isIncremental? this.value : undefined);

    const existingProperties = (Array.isArray(container) && container.length) || (isPlainObject(container) && Object.keys(container).length);
    if (!existingProperties && !this.isMandatory && this.input === undefined && !this.isDeep && !this.hasIncompleteDescendents) {
      return [];
    }
    if (existingProperties && this.context.final) {
      Object.keys(container).forEach(key => {
        if (this.isStrict || this.schema?.getPropertySchema(key)) {
          propertyKeys.add(key)
        }
      });
    }
    //return [...propertyKeys].map(propertyKey => this.relative(propertyKey)).filter(s => s?.isComplete === false);
    return [...propertyKeys].map(propertyKey => this.relative(propertyKey));
  }


  /**
   * @param {...any} args
   * @internal
   */
  _debug(...args) {
    if (!this.context._debugEnabled) return;  // maybe save some argument nonsense below?

    this.context._debug({path: this.path}, {contextName: 'state'}, ...args);
  }
}