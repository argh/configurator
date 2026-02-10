import { TraversalState } from "../traversal-state.js";

/**
 * @param {TraversalState} state
 * @returns {Promise<void>}
 */
export async function inputToPending(state) {
  state.input = state.assignedInput;
  state.pending = state.input;
}