import { TraversalState } from '../traversal-state.js';
import { SchemaError } from '../../schema-errors.js';
import { CompiledSchema } from '../../compiled-schema.js';


/**
 * @param {TraversalState} state
 * @returns {TraversalState|undefined|null|Promise<TraversalState|undefined|null>}
 */
export function preparePending(state) {

  if (state.location === undefined) {
    return undefined;
  }
  const schema = state.location.schema;

  if (state.input === undefined) {
    if (!schema.options.allowUndefined) {
      return state;
    }
  }

  if (state.isContainer) {
    if (state.pending !== undefined) {
      return state; // use existing
    }
    if (state.value !== undefined) {
      if (state.isIncremental) {
        state.pending = state.value;
        return state;
      }
      else {
        throw new SchemaError('Value already processed', {location: state.location});
      }
    }

    // create an empty container
    const normalized = schema._normalizeValue(true, state.target, state.location, state.options);

    if (normalized instanceof Promise) {
      return normalized.then(normalized => {
        state.pending = normalized;
        return state;
      })
    }
    state.pending = normalized;
    return state;
  }
  else {
    state.pending = state.input;
    return state;
  }

}