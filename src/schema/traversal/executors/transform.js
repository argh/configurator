import { deepEquals, isEmpty } from '../../../utils.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function transform(state) {

  if (state.isPruned) {
    return null;
  }
  if (state.isComplete) {
    return state;
  }
  if (!state.condition) {
    return undefined;
  }

  if (state.schema === undefined || state.isUnion) {
    return state;
  }

  if (state.value !== undefined && ((state.value === state.pending)
                                    || (state.isContainer && state.isIncremental
                                        && deepEquals(state.pending, state.value)))) {
    state.pending = undefined;
    return state;
  }
  if (state.pending === undefined) {
    return state;
  }
  if (state.schema?.isImplicit) {
    // implicit schemas never directly transform; they must use a value prepared by their parent.
    return state;
  }
  if (!state.hasWorkInProgress || (state.isContainer && state.isOpaque && state.hasIncompleteDescendents)) {
    return state;
  }

  if (state.isContainer && state.isIncremental && !state.mandatory && isEmpty(state.pending)) {
    return state;
  }

  // seems to be safe to do the transform

  const result = state.schema._transformValue(state.pending, state.target, state.location, state.options);

  /**
   * @param {any} transformed
   * @returns {TraversalState|null}
   */
  const updateState = (transformed) => {
    if (transformed !== undefined) {
      state.pending = undefined;
      state.value = transformed;
    }
    return (state.value === null)? null : state;
  }

  return (result instanceof Promise)? result.then(updateState) : updateState(result);
}