import { TraversalState } from '../traversal-state.js';
import { ValidationError } from '../../schema-errors.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState}
 */
export function checkRequired(state) {

  if (!state.condition) {
    return state;
  }

  if (state.context.final && state.isRequired && (state.value === undefined)) {
    throw new ValidationError('Undefined required value', {path: state.path})
  }
  return state;
}