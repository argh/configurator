
import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @returns {Promise<void|symbol>}
 */
export async function inputToValue(state) {
// fixme - this needs to be improved
  state.input = state.assignedInput;

  if (state.input === undefined) {
    return TraversalControl.SKIP;
  }
  state.value = state.input;
}