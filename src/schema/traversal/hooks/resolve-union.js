import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol>}
 */
export async function resolveUnion(state) {
  if (!state.schema?.isUnion) {
    return TraversalControl.OK;
  }
  const configuration = state.context.getValue();
  const value = state.pending ?? state.input ?? state.value;  // todo - think about this, it's pretty weird.
  const unionSchema = await state.schema._discriminateUnion(value, configuration, state.location,
    {strict: state.context.final});

  if (unionSchema !== undefined) {
    state.unionKey = state.schema.findUnionKey(unionSchema);
    state.schema = unionSchema;
    state.invalidateChildren();  // yuck, but necessary...
    return TraversalControl.RESTART;
  }

  return TraversalControl.OK;
}