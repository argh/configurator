
import { TraversalState } from "../traversal-state.js";

/**
 *
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<void>}
 */
export async function existingProperty(state, propertyState) {
  const propertyName = state.name;
  const propertyKey = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;

  propertyState.input = state.value?.[propertyKey];
}