import { TraversalState } from "../traversal-state.js";

/**
 * If the input is undefined but the schema defines a default, use that value
 *
 * @param {TraversalState} state
 * @returns {TraversalState}
 */
export function defaults(state) {
  if (state.assignedInput === undefined && state.pending === undefined && state.value === undefined) {
    if (state.schema?.default !== undefined) {
      state.assignedInput = state.schema.default;
      state.mandatory = true; // does this need to be earlier?
    }
    else if (state.isDeep && state.isContainer) {
      state.assignedInput = true;
    }
  }
  return state;
}