import { TraversalState } from '../traversal-state.js';
import { PipelineExecutor } from '../../executor/pipeline-executor.js';
import { ValidationError } from '../../schema-errors.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|Promise<TraversalState>}
 */
export function validate(state) {

//  const doValidation = state.context.final || (state.value !== undefined && (state.isIncremental || !state.isContainer));
  const doValidation = state.context.final || state.isComplete;

  if (!doValidation) {
    const foo = state.isComplete;
    return state;
  }

  if (state.schema === undefined) {
    if (state.allowUnknown) {
      return state;
    }
    throw new ValidationError('Unknown value', {path: state.path});
  }
  if (state.schema.isUnion) {
    throw new ValidationError('Unable to resolve union', {path: state.path})
  }

  if (state.value === undefined && state.schema.isReference && !state.isRequired) {
    return state;
  }

  if (state.hasWorkInProgress) {
    if (state.value === undefined && !state.isRequired) {
      return state;
    }

    const foo = state.hasWorkInProgress;
    throw new ValidationError(`Incomplete assignment`, {value: state.pending, path: state.path});
  }
  if (state.value === undefined) {
    return state;
  }

  const result = state.schema._validateValue(state.value, state.target, state.location, state.options);

  /**
   * @param {any} validated
   * @returns {TraversalState}
   */
  const updateState = (validated) => {
    if (validated !== state.value) {
      state.value = validated;
    }
    return state;
  }

  return (result instanceof Promise)? result.then(updateState) : updateState(result);
}