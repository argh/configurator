import { TraversalControl } from '../traversal-hooks.js';
import { TraversalProperty } from '../traversal-property.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @param {TraversalProperty} property
 * @returns {Promise<symbol>}
 */
export async function propertyStart1(state, property) {
  property.input = state.input?.[property.propertyName] ?? property.state.input;
  if (property.unionKey && property.state.unionKey !== property.unionKey) {
    // this property is irrelevant
    property.value = null;
    return TraversalControl.SKIP;
  }
  return TraversalControl.OK;
}

/**
 *
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol>}
 */
export async function propertyStart(state, propertyState) {

  const propertyInput = state.input?.[propertyState.name];

  if (propertyInput !== undefined) {
    propertyState.assignedInput = propertyInput;
  }
  return TraversalControl.OK;
}