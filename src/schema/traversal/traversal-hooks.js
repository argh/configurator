/**
 * @callback TraversalHook
 * @param {TraversalState} state
 * @param {...any} hookArgs
 * @returns {Promise<symbol|void>}
 */

import { TraversalState } from "./traversal-state.js";

export const TraversalControl = {
  OK: Symbol('OK'),
  SKIP: Symbol('SKIP'),
  RESTART: Symbol('RESTART'),
  STOP: Symbol('STOP')
}

export class TraversalHooks
{
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
   * @internal
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
   * @param {TraversalState} [propertyState]
   * @returns {Promise<symbol>}
   * @internal
   */
  async callHooks(hookName, state, propertyState) {
    if (!state.location) {
      // coding error!  should never be here.
      throw new Error('Cannot call hooks when the schema location is unknown!');
    }
    for (let hook of this.hooks[hookName] ?? []) {
      if (state.value === null) {
        // explicitly pruned, processing stops
        return TraversalControl.SKIP;
      }
//      state._debug('hook', hookName, hook.name, args?.[0]?.path ?? '');
      const result = await hook(state, propertyState, hookName) ?? TraversalControl.OK;

      // maybe should be skip?  (example use case: defer container)
      if (result === TraversalControl.STOP) {
//        state._debug('hook STOP', hookName, hook.name);
        return TraversalControl.OK;
      }

      if (result !== TraversalControl.OK) {
//        state._debug('hook SKIP(?)', hookName, hook.name);
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
   * @internal
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
   * @internal
   */
  async endCurrent(state) {
    return await this.callHooks('endCurrent', state);
  }

  /**
   * @param {TraversalState} state
   * @param {TraversalState} propertyState
   * @returns {Promise<symbol>}
   * @internal
   */
  async startProperty(state, propertyState) {
    return await this.callHooks('startProperty', state, propertyState);
  }

  /**
   *
   * @param {TraversalState} state
   * @param {TraversalState} propertyState
   * @returns {Promise<symbol>}
   * @internal
   */
  async endProperty(state, propertyState) {
    return await this.callHooks('endProperty', state, propertyState);
  }
}