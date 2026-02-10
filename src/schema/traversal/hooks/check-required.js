import { ValidationError } from '../../../errors.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function checkRequired(state) {
  if (state.context.final && state.schema?.required && (state.value === undefined)) {
    throw new ValidationError('Undefined required value', {path: state.path})
  }
}