import { deepEquals } from '../../../utils.js';
import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @param {string} hookName
 * @returns {Promise<symbol|void>}
 */
export async function transform(state, hookName) {
  if (state.value !== undefined && ((state.value === state.pending)
                                    || (state.isContainer && state.isIncremental
                                        && deepEquals(state.pending, state.value)))) {
    state.pending = undefined;
    return TraversalControl.OK;
  }
  if (state.schema?.isImplicit) {
    // implicit schemas never directly transform; they must use a value prepared by their parent.
    return TraversalControl.OK;
  }
  if (state.pending === undefined || state.schema === undefined || state.isUnion /*|| state.isEmptyPlaceholder*/) {
    return TraversalControl.OK;
  }
  if (!state.hasWorkInProgress || (state.isContainer && state.isOpaque && state.hasPendingChildren)) {
    return TraversalControl.OK;
  }
  const shouldPreTransform = !state.isContainer || state.isIncremental;
  const shouldPostTransform = state.context.final;  // by definition, we know we have a pending value here

  const shouldTransform = ((hookName === 'startCurrent' && shouldPreTransform)
                           || (hookName === 'endCurrent' && shouldPostTransform))

  if (shouldTransform) {
    const configuration = state.context.getValue();
    const transformed = await state.schema._transformValue(state.pending, configuration, state.location);

    if (transformed !== undefined) {
      state.pending = undefined;
      state.value = transformed;
    }
  }
  return TraversalControl.OK;
}