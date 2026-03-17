import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined}
 */
export function checkInput(state) {

  if (state.input === null) {
    return null;
  }
  if (state.schema === undefined) { //} || state.schema.isImplicit) {
    return undefined;
  }
  if (state.schema.isImplicit) {
    return state;
  }

  // we can't check whether undefined is accepted
  if (state.input === undefined) {
    return state;
  }

  state.schema.ensureAccepts(state.input);

  return state;
}