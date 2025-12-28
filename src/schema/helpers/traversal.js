
/**
 * @typedef TraversalProperty
 * @property {TraversalState} state
 * @property {string} propertyName
 * @property {string|number} key
 * @property {string} [unionKey]
 * @property {any} [input]
 * @property {any} [value]
 */

import { fpm } from './fpm.js';
import { SchemaError, ValidationError } from '../../errors.js';
import { deepEquals, deepValue, isPlainObject } from '../../utils.js';
import { stringify } from './stringify.js';

/**
 * @callback TraversalHook
 * @param {TraversalState} state
 * @param {...any} hookArgs
 * @returns {Promise<symbol|void>}
 */

export class TraversalHooks {
  constructor() {
    /** @type {Object.<string,Array<TraversalHook>>} */
    this.hooks = {
      startCurrent: [],
      endCurrent: [],
      startProperty: [],
      endProperty: []
    }
  }
  /**
   *
   * @param {string} hookName
   * @param {TraversalHook|Array.<TraversalHook>} hooks
   * @returns {this}
   */
  hook(hookName, hooks = []) {
    if (!Array.isArray(hooks)) {
      hooks = [hooks];
    }
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(...hooks);
    return this;
  }

  /**
   *
   * @param {string} hookName
   * @param {TraversalState} state
   * @param {...any} args
   * @returns {Promise<symbol>}
   */
  async callHooks(hookName, state, ...args) {
    for (let hook of this.hooks[hookName] ?? []) {
      if (state.value === null) {
        // explicitly pruned, processing stops
        return TraversalControl.SKIP;
      }
      const result = await hook(state, ...args, hookName) ?? TraversalControl.OK;

      // maybe should be skip?  (example use case: defer container)
      if (result === TraversalControl.STOP) {
        return TraversalControl.OK;
      }

      if (result !== TraversalControl.OK) {
        return result; // e.g. skip
      }
    }
    return state.value === null ? TraversalControl.STOP : TraversalControl.OK;
  }

  /**
   * Process the input into a pending (or possibly final) value
   *
   * @param {TraversalState} state
   * @returns {Promise<symbol>}
   */
  async startCurrent(state) {
    const result = await this.callHooks('startCurrent', state);
    if (state.pending === null) {
      state.pending = undefined;
      state.value = null;
      return TraversalControl.SKIP;
    }
    return result;
  }

  /**
   *
   * @param {TraversalState} state
   * @returns {Promise<Symbol>}
   */
  async endCurrent(state) {
    return await this.callHooks('endCurrent', state);
  }

  /**
   * @param {TraversalState} state
   * @param {TraversalProperty} property
   * @returns {Promise<symbol>}
   */
  async startProperty(state, property) {
    return await this.callHooks('startProperty', state, property);
  }

  /**
   *
   * @param {TraversalState} state
   * @param {TraversalProperty} property
   * @returns {Promise<symbol>}
   */
  async endProperty(state, property) {
    return await this.callHooks('endProperty', state, property);
  }
}


export const TraversalControl = {
  OK: Symbol('OK'),
  SKIP: Symbol('SKIP'),
  RESTART: Symbol('RESTART'),
  STOP: Symbol('STOP')
}

/**
 * @typedef {Object} TraversalOptions
 * @property {boolean} [strict]
 * @property {any} [value]
 * @property {Map} [assignments]
 */

export class TraversalContext
{
  /**
   * @param {TraversalOptions} [options]
   */
  constructor(options) {

    this._final = false;
    this.strict = options?.strict ?? true;

    this.counter = 0;

    /** @type {Map.<string,TraversalState>} */
    this.stateMap = new Map();

    if (options?.value !== undefined) {
      const traversalState = this.getState('');
      traversalState.pending = options.value;
    }

    if (options?.assignments) {
      for (let path of options.assignments.keys()) {
        this.getState(path).isExplicit = true;
      }
    }

    /*
    this._value = undefined;
    if (options?.value !== undefined) {
      this.setValue(options.value);
    }

     */
  }

  _finalizeCount = 0;
  set final(finalize) {
    // todo - make this configurable?  (it's really just a last resort to prevent hangs.)
    if (!this._final && finalize && this._finalizeCount++ > 100) {
      throw new SchemaError('Unable to finalize a stable output value');
    }
    this._final = finalize ?? true;
  }

  get final() {
    return Boolean(this._final);
  }
  finalize() {
    this._final = true;
    return this;
  }

  get isComplete() {
    for (const state of this.stateMap.values()) {
      if (!state.isComplete) {
        return false;
      }
    }
    return true;
  }

  get incomplete() {
    const incomplete = new Set();
    for (const state of this.stateMap.values()) {
      if (!state.isComplete) {
        incomplete.add(state.path);
      }
    }
    return incomplete;
  }

  // override the "target" value
  setValue(value) {
    this._value = value;
  }

  // get the root "target" value, or the override if set
  getValue() {
    if (this._value !== undefined) {
      return this._value;
    }
    const traversalState = this.getState('');
    return traversalState?.value;
  }



  /**
   *
   * @param {TraversalState} state
   * @param {string} propertyName
   * @returns {TraversalProperty|undefined}
   */
  getProperty(state, propertyName) {

    const [propertyKey, unionKey] = propertyName.split(':');

    const propertyPath = state.path ? `${state.path}.${propertyKey}` : `${propertyKey}`;
    const propertyState = this.getState(propertyPath);

    if (unionKey && propertyState.unionKey !== unionKey) {
      return undefined;
    }

    const propertySchema = state.schema?.getPropertySchema(propertyKey);

    if (propertyState.schema === undefined) {
      propertyState.schema = propertySchema;
    }
    else if (propertyState.schema !== propertySchema && !propertySchema?.isUnion) {
      propertyState.schema = propertySchema;  // reset it in case our union resolved
      propertyState.value = undefined;        // and force it to re-resolve
    }

    return {
      propertyName,
      unionKey,
      key: /^\d+$/.test(propertyKey) ? Number(propertyKey) : propertyKey,
      state: propertyState
    }
  }

  /**
   * @param {string} path
   * @returns {TraversalState}
   */
  getState(path) {
    const unKeyedPath = path.split('.').map(c => c.split(':')[0]).join('.');

    let state = this.stateMap.get(unKeyedPath);
    if (state !== undefined) {
      return state;
    }

    const context = this;

    /** @type {TraversalState} */
    state = new TraversalState(context, unKeyedPath);

    if (context._value !== undefined) {
      state.value = unKeyedPath === ''? context._value : deepValue(context._value, unKeyedPath);
    }

    this.stateMap.set(unKeyedPath, state);
    return state;
  }

/*
  containerAssignmentsComplete(path) {
    if (path === '' && this.uncompleted.size > 0) {
      return false;
    }
    for (const p of this.uncompleted) {
      if (p.startsWith(`${path}.`)) {
        return false;
      }
    }
    return true;
  }

 */

}

/**
 * @typedef TraversalState1
 * @property {TraversalContext} context
 * @property {string} path
 * @property {Set} inputs
 * @property {import('../compiled-schema.js').CompiledSchema} [schema]
 * @property {string} [unionKey]
 * @property {any} [input]
 * @property {any} [pending]
 * @property {any} [value]
 */

export class TraversalState {
  constructor(context, path) {
    // core fields:
    this._context = context;
    this._path = path;
    this._schema = undefined;

    // state values
    this._input = undefined;     // most recent input
    this._inputs = new Set();    // full set of all inputs converted to values
    this._pending = undefined;   // intermediate value
    this._value = undefined;     // final value
    // explicit state flags
    this._processed = false;          // are we done with final value?
    this._explicit = false;      // was the input explicit or implicit?
    // implicit state flags

  }
  get context() {
    return this._context;
  }
  get path() {
    return this._path;
  }
  set schema(schema) {
    if (this._schema !== schema) {
      this._context.counter++;
    }
    this._schema = schema;  // todo - consider saving previous value?
  }
  get schema() {
    return this._schema;
  }

  set input(input) {
    this._input = input;

    if (this.schema === undefined) {
      // todo - what about unresolved union assignments?
      return;
    }
    if (!this.schema.isContainer && input !== undefined) {
      this.isExplicit = true;
    }

    if (this.schema.isContainer && !this.schema.isUnion) {
      const isEmpty = input === undefined
                      || input === true
                      || (Array.isArray(input) && input.length === 0)
                      || (typeof input === 'object' && Object.keys(input).length === 0);
      if (!isEmpty) {
        this.isExplicit = true;
      }
    }
  }
  get input() {
    return this._input;
  }

  set pending(pending) {
    this._pending = pending;
  }
  get pending() {
    return this._pending;
  }

  set value(value) {
    if (this._value === value) {
      return;
    }
    if (this._value === null) {
      throw new Error(`Cannot set value at ${this._path} - node is pruned`);
    }

    this._value = value;

    if (value !== undefined) {
      this._inputs.add(this._input);
      this._context.counter++;
    }
    if (value === null && !this._processed) {
      this._processed = true;
    }
  }
  get value() {
    return this._value;
  }

  set isExplicit(value) {
    this._explicit = Boolean(value);
  }
  get isExplicit() {
    return this._explicit;
  }

  set isProcessed(value) {
    this._processed = Boolean(value);
  }
  get isProcessed() {
    return this._processed;
  }

  //
  // TODO - check this weird case:
  //        1. create an opaque schema with members {x,y,z}.  z is conditional on {x,y} being defined.
  //        2. assign {x,y,z}; {x,y} will likely get finalized into the object
  //        3. the z assignment wakes up; is there a way to absorb it? or does it turn into a new {z} object?
  //

  get isComplete() {
    if (this._value === null) {
      // pruned!
      return true;
    }
    if (this._value === undefined) {
      // We are definitely not complete if we have no value and required/default settings imply more work to do
      if (this._schema?.required) {
        return false;
      }
      if (this._schema?.default !== undefined) {
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
    if (this.input !== undefined && !this._inputs.has(this.input)) {
      return false;
    }

    // We may not have a value, but nothing seems to indicate we need one.
    return true;
  }



  get hasProcessedInput() {
    return this._value !== undefined && this._input !== undefined && this._inputs.has(this._input);
  }

  get isPlaceholder() {
    if (this.schema?.default !== undefined) {
      return false;
    }
    return !this._explicit && /*this._path !== '' &&*/ this._value === undefined;
  }

  get isContainer() {
    return this._schema?.hasChildren ?? false;
  }

  get isPruned() {
    return this._value === null;
  }

  get isOpaque() {
    if (this._schema === undefined) {
      return true;
    }
    return !this.isContainer || this._schema.opaque;
  }

  get isIncremental() {
    if (this._schema === undefined) {
      return false;
    }
    return this.isContainer && !this._schema.opaque;
  }

  get isUnion() {
    return this._schema?.isUnion ?? false;
  }

  get isUnresolved() {
    return this._schema === undefined || this._schema.isUnion;
  }

  get treatAsExplicit() {
    if (this._schema === undefined) {
      return true;  // force processing so that we know about errors
    }

    if (this._schema.implicit) {
      return false;
    }

    return !(this.isContainer && this.isIncremental);
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

    const hasDefaults = Object.values(this._schema?.properties).some(childSchema => childSchema.default !== undefined);

    return hasChildStates || hasInputProperties;
  }
  /**
   * Are there unresolved children?
   */
  get hasPendingChildren() {
    if (!this.isContainer) {
      return false;
    }

    const childPrefix = this._path ? `${this._path}.` : '';
    return Array.from(this._context.stateMap.values())
                .some(childState =>
                  childState.path !== this._path &&
                  childState.path.startsWith(childPrefix) &&
                  !childState.isComplete
                );
  }

  listPendingChildren() {
    const childPrefix = this._path ? `${this._path}.` : '';

    const pending = new Set([...this.context.stateMap]
      .filter(([path, state]) => (path !== this._path && path.startsWith(childPrefix) && (state.isComplete || state.hasWorkInProgress)))
      .map(([path]) => { return path.slice(childPrefix.length).split('.')[0] }));

    return [...pending];
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

  get hasWorkInProgress() {
    if (this._value === null) {
      return false;
    }
    if (this._pending === undefined) {
      return false;
    }
    if (!this.isContainer) {
      return true;
    }
    if (this.hasPendingChildren) {
      return true;
    }
    const isEmpty = (Array.isArray(this._pending) && this._pending.length === 0)
                    || (typeof this._pending === 'object' && Object.keys(this._pending).length === 0);

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
}



export async function inputToPendingHook(state) {
  state.pending = state.input;
}

export async function deferContainer(state) {
  if (state.schema?.hasChildren && state.pending === undefined) {
    return TraversalControl.STOP;
  }
  return TraversalControl.OK;
}

export async function checkConditionHook(state) {
  const configuration = state.context.getValue();
  state.condition = state.condition || await state.schema?.checkCondition(state.input, configuration, state.path);

  if (!state.condition) {
    state.pending = undefined;

    if (state.context.final) {
      state.value = null;  // mark as pruned
    }
    return TraversalControl.SKIP;
  }

  return TraversalControl.OK;
}

export async function inputToValueHook(state) {
  if (state.input === undefined || state.input === null) {
    return TraversalControl.SKIP;
  }
  state.value = state.input;
}

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|undefined>}
 */
export async function normalizeInputHook(state) {
  if (state.hasProcessedInput) {
    // fast-out to avoid renormalization if possible
    return (state.schema?.hasChildren && !state.schema?.opaque)? TraversalControl.STOP : TraversalControl.SKIP;
  }
  const configuration = state.context.getValue();

  if (state.input !== undefined) {
    const input = await state.schema?.normalizeValue(state.input, configuration, state.path);
    if (input !== undefined) {
      state.input = input;
    }
  }
  // re-check cache in case the normalization produced a different value
  if (state.hasProcessedInput) {
    return TraversalControl.STOP;
  }

}

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|undefined>}
 */
export async function normalizeHook(state) {
  if (state.isContainer) {
    if (!state.isExplicit) {
      // We lazily create containers only when we know we need to store a property value
      return TraversalControl.STOP;
    }

    if (state.pending !== undefined) {
      // will will use the container in progress
    }
    else if (state.value !== undefined && state.isIncremental) {
      state.pending = state.value;
    }
    else {
      const configuration = state.context.getValue();
      state.pending = await state.schema.normalizeValue(true, configuration, state.path);
    }
  }
  else {
    state.pending = state.input;
  }
}

export async function serializeHook(state) {
  const configuration = state.context.getValue();


  const inputValue = state.schema.hasChildren? true : state.input;

  state.value = await state.schema.serializeValue(inputValue, configuration, state.path);
  state.pending = undefined;
}

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function defaultsHook(state) {
  if (true || state.context.final) {
    if (state.input === undefined && state.pending === undefined && state.value === undefined && state.schema?.default !== undefined) {
      state.input = state.schema.default;
      state.isExplicit = true; // does this need to be earlier?
    }
  }
}

/**
 * @param {TraversalState} state
 * @param {string} hookName
 * @returns {Promise<symbol>}
 */
export async function transformHook(state, hookName) {
  if (state.value !== undefined && ((state.value === state.pending)
                                    || (state.isContainer && state.isIncremental
                                        && deepEquals(state.pending, state.value)))) {
    state.pending = undefined;
    return TraversalControl.OK;
  }
  if (state.pending === undefined || state.schema === undefined || state.isUnion /*|| state.isEmptyPlaceholder*/) {
    return TraversalControl.OK;
  }
  if (!state.hasWorkInProgress || (state.isContainer && state.isOpaque && state.hasPendingChildren)) {
    return TraversalControl.OK;
  }
  const shouldPreTransform = !state.isContainer || state.isIncremental;
  const shouldPostTransform = state.context.final;  // by definition, we know we have a pending value here

  const shouldTransform = ((hookName === 'startCurrent' && shouldPreTransform)
                           || (hookName === 'endCurrent' && shouldPostTransform))

  if (shouldTransform) {
    const configuration = state.context.getValue();
    const transformed = await state.schema.transformValue(state.pending, configuration, state.path);

    if (transformed !== undefined) {
      state.pending = undefined;
      state.value = transformed;
    }
  }
  return TraversalControl.OK;
}

export async function pendingToValueHook(state) {
  // we only set the value if things seem ok
  if (state.isUnresolved) {
    return TraversalControl.OK;
  }
  state.value = state.pending;
  state.pending = undefined;
  return TraversalControl.OK;
}

export async function validateHook(state) {

  if (state.context.final) {
    if (state.schema === undefined) {
      throw new ValidationError(fpm('Unknown value', state.path));
    }
    if (state.schema.isUnion) {
      throw new ValidationError(fpm('Unable to resolve union', state.path))
    }

    if (state.hasWorkInProgress) {
      throw new ValidationError(fpm('Incomplete assignment', state.path));
    }

  }
  else if (state.value === undefined) {
    // We won't complain about an undefined value until the final pass.
    return TraversalControl.OK;
  }

  const configuration = state.context.getValue();
  const validated = await state.schema.validateValue(state.value, configuration, state.path);

  if (validated !== state.value) {
    state.value = validated;  // validation is allowed to tweak the value
  }

  // root path needs to mark itself done after validation
  if (state.path === '') {
    state.isProcessed = true;
  }

  return TraversalControl.OK;
}


/**
 * @param {TraversalState} state
 * @returns {Promise<symbol>}
 */
export async function checkRequiredHook(state) {
  if (state.context.final && state.schema?.required && (state.value === undefined)) {
    throw new ValidationError(fpm('Undefined required value', state.path))
  }
  return TraversalControl.OK;
}

export async function startPropertyHook(state, property) {
  property.input = state.input?.[property.propertyName] ?? property.state.input;
  if (property.unionKey && property.state.unionKey !== property.unionKey) {
    // this property is irrelevant
    property.value = null;
    return TraversalControl.SKIP;
  }
  return TraversalControl.OK;
}

export async function copyPropertyValueHook(state, property) {
  property.input = state.input?.[property.propertyName] ?? property.state.input;
  if (property.unionKey && property.state.unionKey !== property.unionKey) {
    // this property is irrelevant
    property.value = null;
    return TraversalControl.SKIP;
  }
  property.value = property.input;
  return TraversalControl.OK;
}

export async function filterPropertyHook(state, property) {
  // Skip empty placeholder containers in final pass
  if (state.context.final && state.isEmptyPlaceholder) {
    return TraversalControl.SKIP;
  }
  return TraversalControl.OK;
}

export async function checkPropertySchema(state, property) {

  if (property.state.schema === undefined) {
    if (!state.schema.isUnion || state.context.final) {
      // invalid property detected
      if (state.context.strict) {
        // current schema may not be a union because we resolved successfully; check the path from the root.
        const pathExists = (state.context.getState('').schema?.isValidPath(property.state.path));
        const message = pathExists? 'Unexpected property' : 'Unknown property';
        throw new ValidationError(fpm(message, property.state.path));
      }
      else {
        property.value = null;
        return TraversalControl.SKIP;
      }
    }
  }
  return TraversalControl.OK;
}

/**
 * @param {TraversalState} state
 * @param {TraversalProperty} property
 * @returns {Promise<symbol|void>}
 */
export async function endPropertyHook(state, property) {
  if (property.value === undefined || property.value === null) {
    return;
  }
  let parentContainer = state.pending ?? state.value;

  if (parentContainer === null) {
    // oops, we shouldn't even be here!
    return TraversalControl.STOP;
  }
  if (parentContainer === undefined || (typeof parentContainer !== 'object')) {
    throw new SchemaError(fpm('Not a valid container', state.path));
  }
  if (!property.state.schema?.implicit) {
    parentContainer[property.key] = property.value;

    if (!property.state.isUnion) {
      property.state.isProcessed = true;
    }
  }
}

export async function existingPropertyHook(state, property) {
  property.input = state.value?.[property.key];
}

export async function checkUnresolvedHook(state) {
  if (!state.context.final) {
    return;
  }

  if (!state.schema) {
    throw new ValidationError(fpm('Failed to resolve', state.path));
  }

//  const incomplete = state.context.getIncomplete();

//  if (incomplete.size) {
//    throw new SchemaError(fpm('Failed to resolve', incomplete.keys()[0]))
//  }

}

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol>}
 */
export async function resolveUnionHook(state) {
  if (!state.schema?.isUnion) {
    return TraversalControl.OK;
  }
  const configuration = state.context.getValue();
  const value = state.pending ?? state.value;
  const unionSchema = await state.schema.discriminateUnion(value, configuration, state.path, {strict: state.context.final});

  if (unionSchema !== undefined) {
    state.unionKey = state.schema.findUnionKey(unionSchema);
    state.schema = unionSchema;
    return TraversalControl.RESTART;

    // FIXME - ugh!
    //         all child properties have state.schema values with this union's property rather than the resolved unionschema property's schema
    //         (this primarily seems to affect the value of "default")

  }

  return TraversalControl.OK;
}

