import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol>}
 */
export async function copyPropertyValue(state, propertyState) {
  const propertyInput = state.input?.[propertyState.name];

  if (propertyInput !== undefined) {
    propertyState.value = propertyInput;
  }
  return TraversalControl.OK;
}