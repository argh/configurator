import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|undefined}
 */
export function prepareExisting(state) {
  if (state.schema === undefined) {
    return undefined;
  }

  if (state.input === undefined) {
    if (!state.schema.options.allowUndefined) {
      return state;
    }
  }

  if (state.isUnion) {
    state.pending ??= state.input;
  }
  else {
    state.value = state.pending ?? state.input;
    state.pending = undefined;
  }

  return state;
}