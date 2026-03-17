import { TraversalState } from '../traversal-state.js';

/**
 * Check whether we have a passing condition.
 *
 * @param {TraversalState} state
 * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
 */
export function checkCondition(state) {
  // once we have passed the condition check, it's locked in
  if (state.condition === true) {
    return state;
  }

  if (state.schema === undefined) {
    return undefined;
  }

  //const value = state.pending ?? state.input ?? state.value;
  // todo - think about this:
  //        resolve-union uses pending/input/value like the snippet I extracted above, why is condition just using input?
  //        hmm, pending will never contain any children before the condition returns true...
  //        possibility: allow pending to build up but never be transformed?


  const result = state.schema.checkCondition(state.input, state.context.getValue(), state.location, {strict: state.context.strict});

  if (result instanceof Promise) {
    return result.then(resolved => {
      state.condition = resolved;
      return resolved ? state : (state.context.final ? null : undefined)
    })
  }
  state.condition = result;
  return state.condition? state : (state.context.final? null : undefined);
}