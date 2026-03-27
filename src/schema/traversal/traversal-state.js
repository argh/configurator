import { CompiledSchema } from '../compiled-schema.js';
import { SchemaLocation } from '../schema-location.js';
import { TraversalContext } from './traversal-context.js';
import { deepEquals, isEmpty, isPlainObject, isPrimitive } from '../../utils.js';
import { Executor } from "../executor/executor.js";
import { SchemaError } from '../schema-errors.js';
import { EMPTY } from '../constants.js';

export class TraversalState
{
  /** @type {TraversalContext} */
  #context;

  /** @type {string} */
  #path;

  /** @type {string} */
  #name;

  /** @type {string|number} */
  #key;

  /** @type {SchemaLocation|undefined} */
  #location;

  /** @type {TraversalState | undefined } */
  #parent;

  /** @type {Map<string,TraversalState>} */
  #children = new Map();

  // state values
  /** @type {any} */
  #assignedInput;

  /** @type {any} */
  #input = undefined;     // most recent input

  /** @type {Set<any,any>} */
  #inputs = new Set();    // full set of all inputs converted to values

  /** @type {any} */
  #pending = undefined;   // intermediate value

  /** @type {any} */
  #value = undefined;     // final value

  /** @type {boolean|undefined} */
  #condition;

  // explicit state flags
  /** @type {boolean} - are we done with final value? */
  #processed = false;

  /** @type {boolean} - cached completion status of this state and its children */
  #completed = false;

  /** @type {boolean|undefined} - cached required status of this state and its children */
  #required = undefined;

  /** @type {boolean} */
  #mandatory = false;      // was the input explicit or implicit?
  // implicit state flags

  /** @type {string[]|undefined} */
  #unionKeys = undefined;

  /** @type {object|undefined} - cached options to provide to processors */
  #options;

  /** @type {{[key:string]:Executor}} */
  executorCache = {};
  /**
   * @param {TraversalContext} context
   * @param {string} path
   */
  constructor(context, path) {
    this.#context = context;
    this.#path = path;
    this.#location = context.root.absolute(path);

    if (this.#path === '') {
      this.#name = '';
    }
    else {
      const dot = this.#path.lastIndexOf('.');
      const parentPath = (dot === -1) ? '' : this.#path.slice(0, dot);
      this.#parent = this.#context.getState(parentPath);
      this.#name = (dot === -1) ? this.#path : this.#path.slice(dot + 1);

      this.#parent.#children.set(this.#name, this);
    }
    this.#key = /^\d+$/.test(this.#name) ? Number(this.#name) : this.#name;

    if (this.#location?.schema !== undefined && !this.#location.schema.hasConditions) {
      this.#condition = true;
    }
    this.completed = false;  // ensure that any parent is now also marked incomplete
  }

  get context() {
    return this.#context;
  }

  get parent() {
    return this.#parent;
  }

  get path() {
    return this.#path;
  }

  get name() {
    return this.#name;
  }

  get key() {
    return this.#key;
  }

  /** @type {SchemaLocation|undefined} */
  get location() {
    if (this.#location === undefined) {
      this.#location = this.context.root.absolute(this.path);
    }
    return this.#location;
  }
  set location(location) {
    this.#location = location;
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
    const currentSchema = this.schema;
    if (currentSchema && currentSchema !== schema) {
      if (currentSchema.isUnion) {
        this.unionKey = currentSchema.findUnionKey(schema);
        if (!this.unionKey) {
          throw new SchemaError('Union resolved to an unknown schema');
        }
        this.executorCache = {};    // previously held old discriminator!
        this.location.schema = schema;
        this.invalidate();
        this.invalidateChildren();  // yuck, but necessary...
      }
      this.context.update();
    }
    this.location.schema = schema;

    if (!schema.hasConditions) {
      this.#condition = true;
    }
  }

  /** @type {boolean|undefined} */
  get condition() {
    return this.#condition;
  }
  set condition(condition) {
    if (this.#condition !== condition) {
      if (condition === false && this.#condition === true) {
        return;  // currently disallowing changing a positive condition; todo - think about this
      }
      this.context.update();
    }
    this.#condition = condition;
  }

  /** @type {string|undefined} */
  get unionKey() {
    return this.#unionKeys? this.#unionKeys[0] : undefined;
  }
  set unionKey(key) {
    if (key === undefined) {
      this.#unionKeys = undefined;
    }
    else {
      this.#unionKeys ??= [];
      this.#unionKeys.unshift(key);
    }
  }


  /**
   * @param {string} propertyName
   * @returns {TraversalState}
   */
  getChildState(propertyName) {
    if (propertyName === '') {
      return this;
    }
    return this.#children.get(propertyName)
           ?? this.context.getState(this.path ? `${this.path}.${propertyName}` : `${propertyName}`)
  }

  get assignedInput() {
    return this.#assignedInput;
  }
  set assignedInput(assignedInput) {
    if (assignedInput === null) {
      this.value = null;  // value pruned!  todo - consider a schema option to allow it to be an input?
      return;
    }
    if (deepEquals(assignedInput, this.#assignedInput)) {
      return;
    }
    // todo - check hasProcessedInput to avoid flapping?
    this.context.update();
    this.processed = false
    this.completed = false;

    this.#assignedInput = assignedInput;
  }

  get input() {
    return this.#input;
  }
  set input(input) {
    if (input === null) {
      this.value = null;  // value pruned!  todo - consider a schema option to allow it to be an input?
      return;
    }
    if (deepEquals(input, this.#input)) {
      return;
    }
    this.context.update();
    this.processed = false;
    this.completed = false;

    this.#input = input;

    if (this.schema === undefined) {
      // todo - what about unresolved union assignments?
      return;
    }
    if (!this.schema?.hasChildren && input !== undefined) {
      this.mandatory = true;
    }

    if (this.schema.hasChildren) {
      if (isPlainObject(input) || (typeof input === 'object' && this.isIncremental)) {
        for (const [k,v] of Object.entries(input)) {
          if (v !== undefined && v !== null) {
            const propertyState = this.getChildState(k);
            propertyState.assignedInput = v;
          }
        }
      }
      else if (Array.isArray(input)) {
        for (let i = 0; i < input.length; ++i) {
          const v = input[i];
          if (v !== undefined && v !== null) {
            const propertyState = this.getChildState(`${i}`);
            propertyState.assignedInput = v;
          }
        }
      }
    }

    if (this.schema?.hasChildren && !this.schema.isUnion) {
      if (input !== EMPTY && (!isEmpty(input) || this.schema.options.allowEmpty)) {
        this.mandatory = true;
      }
    }
  }


  get pending() {
    return this.#pending;
  }
  set pending(pending) {
    if (pending === null) {
      this.value = null;
      this.#pending = undefined;
    }
    this.#pending = pending;
  }

  get value() {
    return this.#value;
  }
  set value(value) {
    // use invalidate() to deliberately set value to undefined!
    if (this.#value !== undefined && value === undefined) {
      throw new SchemaError('Cannot unset value', {location: this.location});
    }

    if (this.#value === value) {
      // todo - deepEquals?
      return;
    }
    if (this.isPruned) {
      // todo - This likely indicates a library coding error.
      //        If user code triggers this exception, file a bug!
      throw new SchemaError(`Cannot set value at ${this.path} - node is pruned`);
    }
    if (isPrimitive(value) && this.schema?.hasChildren && !this.schema?.isImplicit && !this.schema?.isOpaque) {
      throw new SchemaError('Container processing resulted in unexpected primitive', {value, location: this.location});
    }

    this.#value = value;
    this.context.update();

    if (value === undefined) {
//      this.isComplete = false;
      this.completed = false;
    }

    if (this.path === '') {
      this.processed = true;
    }

    if (value !== undefined) {
      this.#inputs.add(this.assignedInput);
    }
    if (value === null && !this.processed) {
      this.processed = true;
//      this.isComplete = true;
      this.completed = true;
    }
  }
  invalidate() {
    // todo - do we really want to clear the condition?
    this.#condition = (this.location?.schema && !this.location.schema.hasConditions) ? true : undefined;
    this.#value = undefined;
    this.#processed = false;
    this.#options = undefined;
    this.context.update();
  }


  // If the input came from the user (e.g. not synthesized as a mid-path container) it must be processed
  get mandatory() {
    return this.#mandatory;
  }
  set mandatory(value) {
    this.#mandatory = Boolean(value);
  }


  get processed() {
    return this.#processed;
  }
  set processed(value) {
    this.#processed = Boolean(value);

    if (this.#processed && !this.hasChildren) {
//      this.isComplete = true;  // short-circuit completion when we know its safe
    }
  }


  get isRequired() {
    if (this.#required !== undefined) {
      return this.#required;
    }
    if (this.schema?.required) {
      this.#required = true;
    }
    else if (!this.hasChildren) {
      this.#required = false;
    }
    else if (this.isDeep) {
      for (const child of this.#children.values()) {
        if (child.isRequired) {
          this.#required = true;
          break;
        }
      }
    }
    return this.#required ?? false;
  }

  // TODO - check this weird case:
  //        1. create an opaque schema with members {x,y,z}.  z is conditional on {x,y} being defined.
  //        2. assign {x,y,z}; {x,y} will likely get finalized into the object
  //        3. the z assignment wakes up; is there a way to absorb it? or does it turn into a new {z} object?

  // todo - flip how this works; any new child assignment should mark parent incomplete

  /** @type {boolean} */
  get isComplete() {

    if (this.completed) {
      return true;
    }

    if (this.isPruned) {
//      this.isComplete = true;
      return true;
    }
    if (this.value === undefined) {
      // We are definitely not complete if we have no value and required/default settings imply more work to do
      if (this.isRequired) {
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
    if (this.isUnion) {  // NEW CHECK, WDYT?
      return false;
    }
    if (this.processed) {
      // Normally, processed would not be enough to imply isComplete; a container that allows incremental
      // assignment may be processed before its children.  However, we've already checked hasWorkInProgress,
      // which recursively checks for incomplete children!

//      this.isComplete = true;
      return true;
    }
    // NEW CHECK:
    if (this.schema?.isImplicit) {
      return true;
    }
    if (this.value !== undefined) {
      return true;  // value is set and no child work above!
    }

    if (this.schema?.isReference && !this.context.final) {
      return false;
    }

    if (this.mandatory) {
      // processing is mandatory!
      return false;
    }
    if (typeof this.assignedInput === 'function' && this.schema?.options.dynamic !== false && this.input === undefined) {
      // we have a dynamic input (default?), but it hasn't returned a value; this is ok when final

      return this.context.final;
    }
    else if (this.assignedInput !== undefined && !this.#inputs.has(this.assignedInput)) {
      // the input does not seem to have been fully processed (nor discarded).
      return false;
    }

    // todo - this is an experiment; is it safe to formalize checking traversals?
    if (this.assignedInput === undefined && this.context.traversals > 0) {
//      this.isComplete = true;
      return true;
    }

    // if we don't have an assignment and are on the final pass, we're complete.
    return Boolean(this.assignedInput === undefined && this.context.final);
  }

  get completed() {
    return this.#completed;
  }
  set completed(value) {
    this.#completed = Boolean(value);

    if (!this.#completed && this.parent?.completed) {
      this.parent.completed = false;
    }
  }

  get hasProcessedInput() {
//    return this.value !== undefined && this.assignedInput !== undefined && this.#inputs.has(this.assignedInput);
    return this.value !== undefined && this.assignedInput !== undefined && this.input !== undefined && this.#inputs.has(this.assignedInput);
  }

  get isPlaceholder() {
    if (this.schema?.default !== undefined) {
      return false;
    }
    return !this.mandatory && /*this.#path !== '' &&*/ this.value === undefined;
  }

  get hasChildren() {
    return this.schema?.hasChildren ?? false;
  }

  get isContainer() {
    return this.schema?.isContainer ?? false;
  }

  get isPruned() {
    return this.#value === null || Boolean(this.#parent?.isPruned);
  }

  get isDeep() {
    return this.schema?.deep ?? this.context.deep;
  }

  get isOpaque() {
    if (this.schema === undefined) {
      return true;
    }
    return !this.hasChildren || this.schema.isOpaque;
  }

  get isIncremental() {
    if (this.schema === undefined) {
      return false;
    }
    return this.hasChildren && !this.schema.isOpaque;
  }

  get isStrict() {
    if (this.schema === undefined) {
      return this.parent?.isStrict ?? this.context.strict;
    }
    else {
      return this.schema.strict ?? this.context.strict;
    }
  }

  get allowUnknown() {
    return !this.isStrict;
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

    return !(this.hasChildren && this.isIncremental);
  }

  get hasDescendentStates() {
    if (!this.hasChildren) {
      return false;
    }
    return this.#children.size > 0;
  }

  get hasDescendentsToTraverse() {
    if (!this.hasChildren) {
      return false;
    }

    // Check for properties in input
    const hasInputProperties = typeof this.#input === 'object' && !isEmpty(this.#input);

//    const hasDefaults = Object.values(this._schema?.properties).some(childSchema => childSchema.default !== undefined);

    return this.hasDescendentStates || hasInputProperties;
  }

  get hasIncompleteDescendents() {
    if (!this.hasChildren) {
      return false;
    }

//    return [...this.#children.values()].some(childState => !childState.isComplete);
    return [...this.#children.values()].some(childState => !childState.completed);
  }
  get incompleteDescendents() {
    if (!this.hasChildren) {
      return [];
    }

    const childPrefix = this.path ? `${this.path}.` : '';
    return Array.from(this.#context.stateMap.values())
                .filter(childState =>
                  childState.path !== this.path &&
                  childState.path.startsWith(childPrefix) &&
                  !childState.isComplete
                );
  }

  findIncompleteChildNames(incomplete = new Set()) {
    for (const childState of this.#children.values()) {
//      if (!childState.isComplete) {
      if (!childState.completed) {
        incomplete.add(childState.name);
      }
    }
    return incomplete;
  }

  listIncompleteChildren() {
    return [...this.#children.values()].filter(childState => !childState.isComplete).map(childState => childState.name);
  }

  listPendingChildren() {

    return [...this.#children.values()].filter(childState => childState.hasWorkInProgress || childState.needsInputProcessing).map(childState => childState.name);
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

    for (const childState of this.#children.values()) {
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
    if (!this.hasChildren) {
      return true;
    }

    if (isEmpty(this.pending)) {
      if (this.schema?.options.allowEmpty) {
        return true;
      }
      // The WIP is an empty array or object; if we have a processed value, that's all that matters.
      if (this.processed) {
        return false;
      }
      if (this.mandatory) {
        return true;
      }
      return false;  /// fixme ????
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
    if (this.isOpaque && this.processed) {
      return [];
    }
    if (!this.condition) {
      return [];
    }
    if (this.pending === undefined && this.value === undefined && !this.schema.options.allowUndefined && !this.schema.options.deep) {
      return [];
    }

    if (!this.schema.hasChildren) {
      return [];
    }


    const propertyKeys = new Set();
    const input = this.input// ?? this.assignedInput;

    if (isPlainObject(input) || Array.isArray(input) || (input && this.isIncremental)) {
      Object.keys(input).forEach(key => {
        propertyKeys.add(key)
      });
    }

    this.findIncompleteChildNames(propertyKeys);

    if (this.isIncremental || this.value === undefined) {
      // If it is opaque and already has a value, it's too late to check the schema's properties
      for (const [propertyKey, propertySchema] of this.schema.propertyEntries) {
        if (propertyKey === '*') {
          continue;
        }
        if (this.context.final || this.isDeep || propertySchema.required || propertySchema.default !== undefined || propertySchema.isReference) {
          propertyKeys.add(propertyKey);
        }
      }
    }

    const container = this.pending ?? (this.isIncremental? this.value : undefined);

    const existingProperties = (Array.isArray(container) && container.length) || (isPlainObject(container) && Object.keys(container).length);
    if (!existingProperties && !this.mandatory && this.input === undefined && !this.isDeep && !this.hasIncompleteDescendents) {
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
    return [...propertyKeys].map(propertyKey => this.getChildState(propertyKey));
  }

  get target() {
    return this.context.getValue();
  }

  get options() {
    if (this.#options === undefined) {
      this.#options = { ...this.context.options, deep: this.isDeep, strict: this.isStrict, state: this, context: this.context }
    }
    return this.#options;
  }
}