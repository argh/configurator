import { TraversalState } from '../traversal-state.js';
import { PipelineExecutor } from '../../executor/pipeline-executor.js';
import { FinalizeError, ValidationError } from '../../schema-errors.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|undefined|Promise<TraversalState|undefined>}
 */
export function finalize(state) {
  if (state.completed) {
    return state;
  }
  if (state.schema === undefined) {
    if (state.allowUnknown) {
      return state;
    }
    throw new FinalizeError('Unknown value', {path: state.path});
  }

  if (!state.schema.requiresFinalization) {
    return state;
  }

  const doFinalization = state.context.final || state.isComplete;

  if (!doFinalization) {
    return undefined;
  }

  if (state.schema.isUnion) {
    throw new FinalizeError('Unable to resolve union', {path: state.path})
  }

  // todo - block reference schemas from having finalizers
  if (state.value === undefined && state.schema.isReference && !state.isRequired) {
    return state;
  }

  if (state.hasWorkInProgress) {
    if (state.value === undefined && !state.isRequired) {
      return state;
    }

    const foo = state.hasWorkInProgress;
    throw new FinalizeError(`Incomplete assignment`, {value: state.pending, path: state.path});
  }
  if (state.value === undefined) {
    return state;
  }

  const result = state.schema._finalizeValue(state.value, state.target, state.location, state.options);

  /**
   * @param {any} finalized
   * @returns {TraversalState}
   */
  const updateState = (finalized) => {
    if (finalized !== state.value) {
      state.value = finalized;
    }
    return state;
  }

  return (result instanceof Promise)? result.then(updateState) : updateState(result);
}