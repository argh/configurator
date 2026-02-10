import { ValidationError } from '../../../errors.js';
import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';

/**
 *
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol>}
 */
export async function checkPropertySchema(state, propertyState) {

  if (propertyState.schema === undefined) {
    if (!state.schema?.isUnion || state.context.final) {
      // invalid property detected
      const strict = state.schema?.strict ?? state.context.strict;
      if (strict) {
        // current schema may not be a union because we resolved successfully; check the path from the root.
        const pathExists = state.context.root.schema?.isValidPath(propertyState.path);
        const message = pathExists ? 'Unexpected property' : 'Unknown property';
        throw new ValidationError(message, {path: propertyState.path});
      }
      else {
        propertyState.value = null;
        return TraversalControl.SKIP;
      }
    }
  }
  return TraversalControl.OK;
}