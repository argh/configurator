import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function preparePending(state) {
  if (state.isContainer) {
    if (!state.isExplicit) {
      // We lazily create containers only when we know we need to store a property value
      return TraversalControl.STOP;
    }

    if (state.pending !== undefined) {
      // will will use the container in progress
    }
    else if (state.value !== undefined && state.isIncremental) {
      state.pending = state.value;
    }
    else {
      const configuration = state.context.getValue();
      state.pending = await state.schema?._normalizeValue(true, configuration, state.location);
    }
  }
  else {
    state.pending = state.input;
  }
}