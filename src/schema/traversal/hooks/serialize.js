import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function serialize(state) {

  if (state.schema?.metadata.omitFromSerialize) {
    // todo - this is hacky, figure out a better approach
    state.pending = undefined;
    state.value = null;
    return TraversalControl.SKIP;
  }

  const configuration = state.context.getValue();

  const inputValue = state.schema?.hasChildren ? true : state.input;

  if (state.value === undefined || !state.isContainer) {
    state.value = await state.schema?._serializeValue(inputValue, configuration, state.location, {traversalState: state});
    state.pending = undefined;
  }
}