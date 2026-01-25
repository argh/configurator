import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol>}
 */
export async function filterProperty(state, propertyState) {
  // Skip empty placeholder containers in final pass
  if (state.context.final && state.isEmptyPlaceholder) {
    return TraversalControl.SKIP;
  }
  return TraversalControl.OK;
}