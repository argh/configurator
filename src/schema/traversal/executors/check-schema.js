import { TraversalState } from '../traversal-state.js';
import { ValidationError } from '../../schema-errors.js';

/**
 *
 * @param {TraversalState} state
 * @returns {TraversalState|undefined|null}
 */
export function checkSchema(state) {

  if (state.schema !== undefined) {
    // If we have a schema, we're good to go.
    return state;
  }

  const parentState = state.parent;

  if (parentState === undefined) {
    throw new ValidationError('invariant: root path schema must be defined');
  }
  if (parentState.schema === undefined) {
    throw new ValidationError('invariant: cannot process a child if parent schema is undefined');
  }

  if (!parentState.schema.isUnion || state.context.final) {
    // invalid property detected
    const strict = parentState?.schema?.strict ?? parentState?.context.strict;
    if (strict) {
      // current schema may not be a union because we resolved successfully; check the path from the root.
      const pathExists = state.context.root.schema?.isValidPath(state.path);
      const message = pathExists ? 'Unexpected property' : 'Unknown property';
      throw new ValidationError(message, {path: state.path});
    }
    else {
      // prune
      state.value = null;

      return null;
    }
  }

  //
  return undefined;
}