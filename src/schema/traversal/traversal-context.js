/**
 * @typedef {Object} TraversalContextOptions
 * @property {boolean} [strict]
 * @property {boolean} [deep]
 * @property {boolean} [debug]
 */
import { SchemaError } from '../../errors.js';
import { SchemaLocation } from '../schema-location.js';

import { TraversalState } from './traversal-state.js';
import { debug } from '../helpers/debug-sink.js';

export class TraversalContext
{
  /**
   * @param {SchemaLocation} root
   * @param {TraversalContextOptions} [options]
   */
  constructor(root, options) {
    this.root = root;
    this._final = false;
    this.strict = options?.strict ?? true;
    this.deep = options?.deep ?? false;

    this.traversals = 0;
    this.counter = 0;

    /** @type {Map.<string,TraversalState>} */
    this.stateMap = new Map();
    this._debugEnabled = options?.debug ?? false;
  }




  update() {
    this.counter++;
    this.final = false;

    this._debug('update', {counter: this.counter, final: this.final})
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
        this._debug('not complete:', {incomplete: this.incomplete});

        return false;
      }
    }
    this._debug('COMPLETE');
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
    this._debug('setting target value');
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
//      state.value = path === ''? context._value : deepValue(context._value, path);
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
}