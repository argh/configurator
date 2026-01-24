

import { TraversalState } from "./traversal-state.js";

/**
 * @internal
 */
export class TraversalProperty {

  /** @type {TraversalState} */
  state;

  /** @type {any} */
  key;

  /** @type {string|undefined} unionKey */
  unionKey;

  /** @type {any} */
  input;

  /** @type {any} */
  value;

  /**
   * @param {TraversalState} propertyState
   */
  constructor(propertyState) {
    this.propertyName = propertyState.name;
    this.state = propertyState;
    this.key = /^\d+$/.test(this.propertyName) ? Number(this.propertyName) : this.propertyName;
  }
}
