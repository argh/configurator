import { deepEquals, isEmpty } from '../../../utils.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function transformEarly(state) {

  if (state.value !== undefined && ((state.value === state.pending)
                                    || (state.hasChildren && state.isIncremental
                                        && deepEquals(state.pending, state.value)))) {
    state.pending = undefined;
    return state;
  }
  if (state.pending === undefined || state.schema === undefined || state.isUnion || state.schema.isImplicit) {
    return state;
  }
  if ((state.hasChildren && state.isOpaque) /*|| !state.hasWorkInProgress*/) {
    return state;
  }

  if (state.hasChildren && !state.mandatory && isEmpty(state.pending)) {
    return state;
  }

  // We will transform early!
  // Note that this implies that any mutations to child properties performed by this transform
  // will very likely get overwritten when the children are traversed!
  //

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