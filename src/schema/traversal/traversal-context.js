/**
 * @typedef {object} TraversalContextOptions
 * @property {boolean} [strict]
 * @property {boolean} [deep]
 * @property {boolean} [debug]
 */
import { SchemaLocation } from '../schema-location.js';

import { TraversalState } from './traversal-state.js';
import { debug } from '../helpers/debug-sink.js';
import { behead } from '../../utils.js';
import { CompiledSchema } from "../compiled-schema.js";
import { SchemaError } from '../schema-errors.js';

export class TraversalContext
{
  /**
   * @param {SchemaLocation|CompiledSchema} root
   * @param {TraversalContextOptions & {[key:string]:any}} [options]
   */
  constructor(root, options = {}) {

    this.root = (root instanceof CompiledSchema)? new SchemaLocation(root) : root;
    this._final = false;

    this._options = {...options, deep: options.deep ?? false, strict: options.strict ?? true, debug: options.debug ?? false}

    this.traversals = 0;
    this.counter = 0;

    /** @type {Map.<string,TraversalState>} */
    this.stateMap = new Map();
    this._debugEnabled = options?.debug ?? false;

    this.compiling = false;  // magic flag needed to prevent union resolution of a CompiledSchema value from being a problem
  }

  get options() {
    return this._options;
  }

  get deep() {
    return this._options.deep;
  }

  get strict() {
    return this._options.strict;
  }

  update() {
    this.counter++;
    this.final = false;

//    this._debug('update', {counter: this.counter, final: this.final})
  }

  _finalizeCount = 0;

  set final(finalize) {
    // todo - make this configurable?  (it's really just a last resort to prevent hangs.)
    if (this._final && !finalize && this._finalizeCount++ > 100) {
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
//        this._debug('not complete:', {incomplete: this.incomplete});

        return false;
      }
    }
//    this._debug('COMPLETE');
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
//    this._debug('setting target value');
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
   * @param {any} input
   * @param {string} [path]
   */
  setAssignedInput(input, path = '') {
    if (input === undefined) {
      return;
    }

    let state = this.getState('');  // start at root

    while (path) {
      const [propertyName, remainingPath] = behead(path);
      const propertyState = state.getChildState(propertyName);

      state.assignedInput ??= true;
      state = propertyState;
      path = remainingPath;
      state.mandatory = true;
    }
    state.assignedInput = input;
    state.mandatory = true;
  }


  /**
   * @param {string|SchemaLocation} path
   * @returns {TraversalState}
   */
  getState(path) {
    if (path instanceof SchemaLocation) {
      path = path.path;
    }
    let state = this.stateMap.get(path);
    if (state === undefined) {
      const context = this;

      /** @type {TraversalState} */
      state = new TraversalState(context, path);

      if (context._value !== undefined) {
//      state.value = path === ''? context.#value : deepValue(context.#value, path);
      }
      this.stateMap.set(path, state);
    }

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

  _debug(...args) {
    if (!this._debugEnabled) return;

    debug({contextName: 'context'}, ...args);
  }

  traverse(executor) {

    const rootState = this.getState('');

    let done = false;

    const updateDone = (counter) => {
      if (this.isComplete) {
        done = true;
      }
      else if (this.counter === counter) {
        if (this.final) {
          done = true;
        }
        else {
          this.final = true;
        }
      }
      else {
        this.final = false;
      }
      return done;
    }

    const loop = () => {
      let result = undefined;
      while (!done) {
        const counter = this.counter;
        result = executor.execute(rootState);

        if (result instanceof Promise) {
          return result.then(
            resolved => updateDone(counter)? resolved : loop(),
            rejected => { throw(rejected) }
          );
        }
        updateDone(counter);
        this.traversals++;
      }
      return result;
    }
    return loop();
  }
}