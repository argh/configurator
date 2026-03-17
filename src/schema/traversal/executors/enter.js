import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @returns {TraversalState|undefined|null}
 */
export function enter(state) {

  const parentState = state.parent;

  if (parentState) {
    if (state.assignedInput === undefined) {
      // we generally have our assigned input pushed down
      const input = parentState.input?.[state.key];

      if (input !== undefined) {
        state.assignedInput = input;
      }
    }
    if (state.schema?.isImplicit && !state.isPruned ) {
      state.value ??= parentState.value?.[state.key];  // fixme ?
    }
  }
  if (state.isPruned) {
    return null;
  }
  if (state.completed) {
    return undefined;
  }
//  if (state.isComplete) {
//    return undefined;
//  }

  return state;
}