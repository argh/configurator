import { ValidationError } from '../../../errors.js';
import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol>}
 */
export async function validate(state) {

  const doValidation = state.context.final || state.schema?.hasChildren === false;

  if (!doValidation) {
    return TraversalControl.OK;
  }

  if (state.schema === undefined) {
    throw new ValidationError('Unknown value', {path: state.path});
  }
  if (state.schema.isUnion) {
    throw new ValidationError('Unable to resolve union', {path: state.path})
  }

  if (state.hasWorkInProgress) {
    //const foo = state.hasWorkInProgress;
    throw new ValidationError(`Incomplete assignment`, {value: state.pending, path: state.path});
  }
  if (state.value === undefined) {
    return TraversalControl.OK;  // can't validate this; will depend on if it is required or not
  }
  const configuration = state.context.getValue();
  const validated = await state.schema?._validateValue(state.value, configuration, state.location, {traversalState: state});

  if (validated !== state.value) {
    state.value = validated;  // validation is allowed to tweak the value
  }

  // root path needs to mark itself done after validation
  if (state.path === '') {
    state.isProcessed = true;
  }

  return TraversalControl.OK;
}