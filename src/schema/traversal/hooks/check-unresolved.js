import { ValidationError } from '../../../errors.js';
import { fpm } from '../../helpers/fpm.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @returns {Promise<void>}
 */
export async function checkUnresolved(state) {
  if (!state.context.final) {
    return;
  }

  if (!state.schema) {
    throw new ValidationError('Failed to resolve', {path: state.path});
  }

//  const incomplete = state.context.getIncomplete();

//  if (incomplete.size) {
//    throw new SchemaError(fpm('Failed to resolve', incomplete.keys()[0]))
//  }

}