import { TraversalState } from "../traversal-state.js";

/**
 * If the input is undefined but the schema defines a default, use that value
 *
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function checkDefaults(state) {
  if (state.assignedInput === undefined && state.pending === undefined && state.value === undefined && state.schema?.default !== undefined) {
    state.assignedInput = state.schema.default;
    state.isMandatory = true; // does this need to be earlier?
  }
}