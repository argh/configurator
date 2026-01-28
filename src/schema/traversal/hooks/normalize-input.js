import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * Normalize the input value
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function normalizeInput(state) {
  if (state.hasProcessedInput) {
    // fast-out to avoid renormalization if possible
    return (state.schema?.hasChildren && !state.schema?.isOpaque) ? TraversalControl.STOP : TraversalControl.SKIP;
  }
  if (state.assignedInput === null) {
    return TraversalControl.STOP;
  }

  const configuration = state.context.getValue();

  if (state.assignedInput !== undefined) {
    const input = await state.schema?._normalizeValue(state.assignedInput, configuration, state.location);
    if (input !== undefined) {
      // verify this input is ok...
      await state.schema?.accepts(input, configuration, state.location, {strict: true});
      state.input = input;
    }
  }
  // re-check cache in case the normalization produced a different value
  if (state.hasProcessedInput) {
    return TraversalControl.STOP;
  }

}