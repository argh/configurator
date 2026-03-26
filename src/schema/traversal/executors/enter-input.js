import { TraversalState } from '../traversal-state.js';

/**
 *
 *
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined}
 */
export function enterInput(state) {
  const parentState = state.parent;

  if (parentState) {
    state.assignedInput ??= parentState.input?.[state.key];
  }
  state.input ??= state.assignedInput;

  if (state.isPruned) {
    return null;
  }
  if (state.completed) {
    return undefined;
  }

  return state;
}