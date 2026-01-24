import { ValidationError } from '../../../errors.js';
import { fpm } from '../../helpers/fpm.js';
import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function validate(state) {

  if (state.context.final) {
    if (state.schema === undefined) {
      throw new ValidationError(fpm('Unknown value', state.path));
    }
    if (state.schema.isUnion) {
      throw new ValidationError(fpm('Unable to resolve union', state.path))
    }

    if (state.hasWorkInProgress) {
      throw new ValidationError(fpm('Incomplete assignment', state.path));
    }

  }
  else if (state.value === undefined) {
    // We won't complain about an undefined value until the final pass.
    return TraversalControl.OK;
  }

  const configuration = state.context.getValue();
  const validated = await state.schema?._validateValue(state.value, configuration, state.location);

  if (validated !== state.value) {
    state.value = validated;  // validation is allowed to tweak the value
  }

  // root path needs to mark itself done after validation
  if (state.path === '') {
    state.isProcessed = true;
  }

  return TraversalControl.OK;
}