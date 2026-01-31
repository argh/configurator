import { TraversalControl } from '../traversal-hooks.js';

export async function simplePending(state) {

  if (state.assignedInput === null || state.assignedInput === undefined || typeof state.assignedInput === 'function') {
    return TraversalControl.SKIP;
  }
  state.input = state.assignedInput;

  if (state.value !== undefined || state.pending !== undefined) {
    return;
  }

  if (state.schema === undefined) {
    if (Array.isArray(state.input)) {
      state.pending = [];
    }
    else if (typeof (state.input === 'object')) {
      state.pending = {};
    }
    else {
      state.pending = state.input;
    }
  }
  else {
    if (state.isContainer) {
      state.pending = await state.schema._normalizeValue(true, state.context.getValue(), state.location);
    }
    else {
      state.pending = state.input;
    }
  }
}