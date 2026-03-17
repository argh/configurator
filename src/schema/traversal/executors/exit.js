import { TraversalState } from '../traversal-state.js';
import { SchemaError } from '../../schema-errors.js';

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function exit(state) {
  if (state.value === undefined || state.value === null) {
    return state;
  }

  const parentState = state.parent;

  // todo - should we fast-out if previously completed?
  state.completed = state.isComplete;

  if (parentState === undefined) {
    // We're processing the root, so we don't need to copy our value anywhere.
    // As long as we are not a union, mark outselves as processed.
    if (!state.isUnion) {
      state.processed = true;
    }
    return state;
  }

  const parentContainer = parentState.pending ?? parentState.value;

  if (parentContainer === null) {
    // oops, we shouldn't even be here!
    return null;
  }

  if (parentContainer === undefined || (typeof parentContainer !== 'object')) {
    // try to be helpful
    let stringifiedParentContainer = `${parentContainer}`;
    if (stringifiedParentContainer.length > 20) {
      stringifiedParentContainer = stringifiedParentContainer.slice(0, 20) + '...'
    }
    const message = stringifiedParentContainer.length?
                    `«${stringifiedParentContainer}» is not a valid container (set opaque option?)`
                    : 'Not a valid container (set opaque option?)'

    throw new SchemaError(message, {path: parentState.path});
  }

  const key = state.key;

  if (state.schema?.isImplicit) {
    state.value ??= parentContainer[key];  // set this so that children can use this as a container
    state.processed = true;
  }
  else {
    if (parentContainer[key] !== state.value) {
      parentContainer[key] = state.value;
    }

    if (!state.isUnion) {
      state.processed = true;
    }
  }
  return state;
}