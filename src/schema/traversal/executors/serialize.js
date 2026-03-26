import { TraversalState } from '../traversal-state.js';
import { isPlainObject, isTruthy } from '../../../utils.js';

/**
 * Serialize the pending/input and save as output state value
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function serialize(state) {
  if (state.schema === undefined) {
    return undefined;
  }

  if (state.schema.isImplicit || isTruthy(state.schema.metadata.omitFromSerialize)) {
    state.value = null;
    return null;
  }

  const serializers = state.schema.handlers.serializers ?? [];
  if (!state.schema.isOpaque && serializers.length === 0) {
    if (state.schema.isArray) {
      if (!Array.isArray(state.value)) {
        state.value = [];
      }
    }
    else if (state.schema.hasChildren) {
      if (!isPlainObject(state.value)) {
        state.value = {};
      }
    }
    else {
      state.value = JSON.parse(JSON.stringify(state.pending ?? state.input))
    }
    return state;
  }

  const result = state.schema._serializeValue(state.input, state.target, state.location, state.options);

  /**
   * @param {any} serialized
   * @returns {null|TraversalState}
   */
  const updateState = (serialized) => {
    state.value = serialized;
    return (state.value === null)? null : state;
  }

  return (result instanceof Promise)? result.then(updateState) : updateState(result);
}