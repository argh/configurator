import { TraversalControl } from '../traversal-hooks.js';
import { TraversalProperty } from '../traversal-property.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @param {TraversalProperty }property
 * @returns {Promise<symbol>}
 */
export async function filterProperty(state, property) {
  // Skip empty placeholder containers in final pass
  if (state.context.final && state.isEmptyPlaceholder) {
    return TraversalControl.SKIP;
  }
  return TraversalControl.OK;
}