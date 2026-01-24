import { TraversalProperty } from "../traversal-property.js";
import { TraversalState } from "../traversal-state.js";

/**
 *
 * @param {TraversalState} state
 * @param {TraversalProperty} property
 * @returns {Promise<void>}
 */
export async function existingProperty(state, property) {
  property.input = state.value?.[property.key];
}