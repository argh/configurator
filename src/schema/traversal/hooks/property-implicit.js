import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol>}
 */
export async function propertyImplicit(state, propertyState) {

  if (propertyState.schema?.isImplicit && state.value !== undefined) {
    if (propertyState.input === undefined) {
//      propertyState.input = propertyState.assignedInput;
    }
    propertyState.value = state.value?.[propertyState.name];
  }
  return TraversalControl.OK;
}