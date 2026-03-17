import { TraversalState } from "../traversal-state.js";

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined}
 */
export function enterExisting(state) {
  if (state.assignedInput === undefined && state.parent) {
    state.assignedInput = state.parent.input?.[state.key];
  }
  if (state.isPruned) {
    return null;
  }
  if (state.isComplete) {
    return undefined;
  }

  state.input = state.assignedInput;

  if (state.schema !== undefined) {
    state.pending = state.input;
  }

  return state;
}