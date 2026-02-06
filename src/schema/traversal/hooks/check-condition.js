import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * Check whether we have a passing condition.
 *
 * @param {TraversalState} state
 * @returns {Promise<void|symbol>}
 */
export async function checkCondition(state) {
  const configuration = state.context.getValue();

  state.condition = state.condition || await state.schema?._checkCondition(state.input, configuration, state.location, {traversalState: state});

  if (state.condition) {
    return TraversalControl.OK;
  }

  state.pending = undefined;

  if (state.context.final) {
    state.value = null; // mark as pruned
    return TraversalControl.STOP;
  }
  return TraversalControl.SKIP;
}