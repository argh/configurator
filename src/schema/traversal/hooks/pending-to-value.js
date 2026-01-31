import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function pendingToValue(state) {
  // we only set the value if things seem ok
  if (state.isUnresolved) {
    return TraversalControl.OK;
  }
  state.value = state.pending;
  state.pending = undefined;
  return TraversalControl.OK;
}