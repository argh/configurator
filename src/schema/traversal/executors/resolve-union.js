import { TraversalState } from '../traversal-state.js';

import { UnionResolutionError } from '../../schema-errors.js';
import { CompiledSchema } from "../../compiled-schema.js";

/**
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function resolveUnion(state) {

  if (!state.schema?.isUnion || !state.location) {
    return state;
  }

  // todo - think about this, it's pretty weird (a union should never have .value, I think!)
  //        counterpoint: what about pre-existing data being validated?

  const value = state.pending ?? state.input ?? state.value;
  const result = state.schema._discriminateUnion(value, state.target, state.location, {...state.options, strict: state.context.final});

  /**
   * @param {CompiledSchema|undefined} unionSchema
   * @returns {TraversalState}
   */
  const handleUnionSchema = (unionSchema) => {
    if (unionSchema) {
      state.schema = unionSchema;
      //return undefined;  // consider forcing a loop so that we re-normalize with the new schema?
    }
    else {
      if (state.context.final) {
        throw new UnionResolutionError('Unable to resolve union', {location: state.location});
      }
    }
    return state;
  }

  return (result instanceof Promise)
         ? result.then(resolved => handleUnionSchema(resolved))
         : handleUnionSchema(result);
}

