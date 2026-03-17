import { TraversalState } from '../traversal-state.js';

/**
 * Normalize the assigned input value
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function normalize(state) {
  if (state.processed && state.hasProcessedInput) {
    // fast-out to avoid renormalization if possible
    return state;
  }
  if (state.assignedInput === null) {
    return null;
  }
  if (state.assignedInput === undefined) {
    return state;
  }
  if (state.location === undefined) {
    return undefined;
  }
  const schema = state.location.schema;
  const normalized = schema._normalizeValue(state.assignedInput, state.target, state.location, state.options);

  /**
   * @param {any} normalized
   * @returns {TraversalState|null}
   */
  const updateState = (normalized) => {
    state.input = normalized;

    if (normalized === null) {
      return null;
    }
    return state;
  }
  return (normalized instanceof Promise)? normalized.then(updateState) : updateState(normalized);
}