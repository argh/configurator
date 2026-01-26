import { CompiledSchema } from '../compiled-schema.js';
import { SchemaLocation } from '../schema-location.js';
import { TraversalContext } from './traversal-context.js';
import { isPlainObject } from '../../utils.js';

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
    if (this._path !== '') {
      const dot = this._path.indexOf('.');
      const parentPath = (dot === -1) ? '' : this._path.slice(0, dot);
      this._parent = this._context.getState(parentPath);
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
    this._explicit = false;      // was the input explicit or implicit?
    // implicit state flags

    /** @type {string|undefined} */
    this.unionKey = undefined;
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
    const propertyPath = this.path ? `${this.path}.${relativePath}` : `${relativePath}`;
    return this.context.getState(propertyPath);
  }


  get path() {
    return this._path;
  }

  get name() {
    const dot = this.path.lastIndexOf('.');

    if (dot === -1) {
      return this.path;
    }
    else {
      return this.path.slice(dot + 1);
    }
  }

  /** @type {SchemaLocation|undefined} */
  get location() {
    if (this._location === undefined) {
      this._location = this.context.root.absolute(this.path);
    }
    return this._location;
  }
  set location(location) {
    this._location = location;
  }

  /** @type {CompiledSchema|undefined} */
  get schema() {
    return this.location?.schema;
  }
  set schema(schema) {
    // todo - figure this out
    if (this.location === undefined || schema === undefined) {
      throw new Error('FIXME');
    }
    if (this.schema !== schema) {
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
      this.context.update();
    }
    this._condition = condition;
  }

  get assignedInput() {
    return this._assignedInput;
  }
  set assignedInput(input) {
    this._assignedInput = input;
  }

  get input() {
    return this._input;
  }
  set input(input) {
    this._input = input;

    if (this.schema === undefined) {
      // todo - what about unresolved union assignments?
      return;
    }
    if (!this.schema?.hasChildren && input !== undefined) {
      this.isExplicit = true;
    }

    if (this.schema?.hasChildren && !this.schema.isUnion) {
      const isEmpty = input === undefined
                      || input === null
                      || input === true
                      || (Array.isArray(input) && input.length === 0)
                      || (typeof input === 'object' && Object.keys(input).length === 0);
      if (!isEmpty) {
        this.isExplicit = true;
      }
    }
  }


  get pending() {
    return this._pending;
  }
  set pending(pending) {
    this._pending = pending;
  }

  get value() {
    return this._value;
  }
  set value(value) {
    if (value === true && this.schema?.hasChildren) {
      // FIXME - debugging
      throw new Error('whoops');
    }
    if (this._value === value) {
      return;
    }
    if (this._value === null) {
      // FIXME - error type
      throw new Error(`Cannot set value at ${this._path} - node is pruned`);
    }

    this._value = value;

    if (value !== undefined) {
      this._inputs.add(this.assignedInput);
      this.context.update();
    }
    if (value === null && !this.processed) {
      this.processed = true;
    }
  }


  get isExplicit() {
    return this._explicit;
  }
  set isExplicit(value) {
    this._explicit = Boolean(value);
  }


  get isProcessed() {
    return this._processed;
  }
  set isProcessed(value) {
    this._processed = Boolean(value);
  }


  //
  // TODO - check this weird case:
  //        1. create an opaque schema with members {x,y,z}.  z is conditional on {x,y} being defined.
  //        2. assign {x,y,z}; {x,y} will likely get finalized into the object
  //        3. the z assignment wakes up; is there a way to absorb it? or does it turn into a new {z} object?
  //

  get isComplete() {
    if (this.value === null) {
      // pruned!
      return true;
    }
    if (this.value === undefined) {
      // We are definitely not complete if we have no value and required/default settings imply more work to do
      if (this.schema?.required) {
        return false;
      }
      // fixme - what about default functions?  it could return undefined.
      if (this.schema?.default !== undefined) {
        return false;
      }
    }
    if (this.hasWorkInProgress) {
      return false;
    }
    if (this.hasPendingChildren) {
      return false;
    }
    if (this.isProcessed) {
      return true;
    }
    if (this.isExplicit) {
      return false;
    }
    if (typeof this.assignedInput === 'function' && this.input === undefined) {
      return false;
    }
    else if (this.assignedInput !== undefined && !this._inputs.has(this.assignedInput)) {
      return false;
    }

    // We may not have a value, but nothing seems to indicate we need one.
    return true;
  }


  get hasProcessedInput() {
//    return this.value !== undefined && this.assignedInput !== undefined && this._inputs.has(this.assignedInput);
    return this.value !== undefined && this.assignedInput !== undefined && this.input !== undefined && this._inputs.has(this.assignedInput);
  }

  get isPlaceholder() {
    if (this.schema?.default !== undefined) {
      return false;
    }
    return !this.isExplicit && /*this._path !== '' &&*/ this.value === undefined;
  }

  get isContainer() {
    return this.schema?.hasChildren ?? false;
  }

  get isPruned() {
    return this._value === null;
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

  get childStates() {
    if (!this.isContainer) {
      return [];
    }
    // Check for child states in state map
    const childPrefix = this._path ? `${this._path}.` : '';
    return Array.from(this._context.stateMap.values())
                .filter(s => s.path !== this._path && s.path.startsWith(childPrefix));
  }


  /**
   * Are there child states or child properties to traverse?
   */
  get hasChildrenToTraverse() {
    if (!this.isContainer) {
      return false;
    }

    // Check for child states in state map
    const childPrefix = this._path ? `${this._path}.` : '';
    const hasChildStates = Array.from(this._context.stateMap.keys())
                                .some(p => p !== this._path && p.startsWith(childPrefix));

    // Check for properties in input
    const hasInputProperties = typeof this._input === 'object'
                               && this._input !== null
                               && Object.keys(this._input).length > 0;

//    const hasDefaults = Object.values(this._schema?.properties).some(childSchema => childSchema.default !== undefined);

    return hasChildStates || hasInputProperties;
  }

  /**
   * Are there unresolved children?
   */
  get hasPendingChildren() {
    if (!this.isContainer) {
      return false;
    }

    const childPrefix = this.path ? `${this.path}.` : '';
    return Array.from(this._context.stateMap.values())
                .some(childState =>
                  childState.path !== this.path &&
                  childState.path.startsWith(childPrefix) &&
                  !childState.isComplete
                );
  }

  listPendingChildren() {
    const childPrefix = this.path ? `${this.path}.` : '';

    const pending = new Set([...this.context.stateMap]
      .filter(([path, state]) => (path !== this.path && path.startsWith(
        childPrefix) && (state.isComplete || state.hasWorkInProgress || state.needsInputProcessing)))
      .map(([path]) => {
        return path.slice(childPrefix.length).split('.')[0]
      }));

    return [...pending];
  }

  invalidateChildren() {
    // this is called after union resolution!

    for (const childState of this.childStates) {
      if (childState.value !== null) {
// fixme?        childState.schema = undefined;
        childState.value = undefined;
        // todo - verify that this is unnecessary for sane schemas
        // childState.pending = undefined;
      }
    }
  }

  /**
   * Is this an empty placeholder (no children, no input)?
   */
  get isEmptyPlaceholder() {
    if (!this.schema?.hasChildren) {
      // concrete schemas are never placeholders
      return false;
    }
    /* note: old code in transform.. are we capturing this?
  if (state.schema.hasChildren && !state.schema.opaque && state.input === undefined) {
    if ((Array.isArray(state.pending) && state.pending.length === 0)
        || (isPlainObject(state.pending) && Object.keys(state.pending).length === 0)) {
      // implicitly created containers that remain empty shouldn't get transformed
      return TraversalControl.OK;
    }
  }
     */
    if (!this.isPlaceholder) {
      return false;
    }

    return !this.hasChildrenToTraverse;
  }

  get needsInputProcessing() {
    if (this.value !== undefined) {
      return false;
    }
    return (typeof this.assignedInput !== undefined && (this.input === undefined || this.pending === undefined));
  }

  get hasWorkInProgress() {
    if (this.value === null) {
      return false;
    }
    if (this.pending === undefined) {
      return false;
    }
    if (this.schema?.isImplicit) {
      return false;
    }
    if (!this.isContainer) {
      return true;
    }
    if (this.hasPendingChildren) {
      return true;
    }

    const isEmpty = (Array.isArray(this.pending) && this.pending.length === 0)
                    || (typeof this.pending === 'object' && Object.keys(this.pending).length === 0);

    if (isEmpty) {
      // The WIP is an empty array or object; if we have a processed value, that's all that matters.
      if (this.isProcessed) {
        return false;
      }
      if (this.isExplicit) {
        return true;
      }
    }
    return true;
  }

  /**
   * @returns {TraversalState[]}
   */
  get activePropertyStates() {
    if (this.schema === undefined) {
      return [];
    }
    const propertyKeys = new Set();
    const input = this.input ?? this.assignedInput;
    if (isPlainObject(input) || Array.isArray(input) || (input && !this.isOpaque)) {
      Object.keys(input).forEach(key => propertyKeys.add(key));
    }
    if (this.context.final) {
      Object.keys(this.schema.properties).forEach(key => { if (key !== '*') { propertyKeys.add(key) } } );

      if (this.schema.hasWildcard) {
        // wildcard, so let's look for any interesting children in the state map
//          state.listPendingChildren().forEach(path => propertyKeys.add(path));
      }
    }
    // fixme - I hate this
    this.listPendingChildren().forEach(path => propertyKeys.add(path));
    // fixme
    const container = this.pending ?? this.value;

    const existingProperties = (Array.isArray(container) && container.length) || (isPlainObject(container) && Object.keys(container).length);
// todo - think about this; state.input==undefined is an unreliable indicator of "no work to do" as we might have lingering conditions/etc for final pass
    if (!existingProperties && !this.isExplicit && this.input === undefined && !this.isDeep) {
      return [];
    }
    const strict = this.schema?.strict ?? this.context.strict;
    if (existingProperties && this.context.final) {
      Object.keys(container).forEach(key => {
        if (strict || this.schema?.getPropertySchema(key)) {
          propertyKeys.add(key)
        }
      });
    }

    return [...propertyKeys].map(propertyKey => this.relative(propertyKey)).filter(Boolean);
  }
}