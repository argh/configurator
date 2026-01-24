import { TraversalControl } from '../traversal-hooks.js';
import { SchemaError } from '../../../errors.js';
import { fpm } from '../../helpers/fpm.js';
import { TraversalState } from '../traversal-state.js';
import { TraversalProperty } from '../traversal-property.js';

/**
 * @param {TraversalState} state
 * @param {TraversalProperty} property
 * @returns {Promise<symbol|void>}
 */
export async function propertyEnd1(state, property) {
  if (property.value === undefined || property.value === null) {
    return;
  }
  let parentContainer = state.pending ?? state.value;

  if (parentContainer === null) {
    // oops, we shouldn't even be here!
    return TraversalControl.STOP;
  }
  if (parentContainer === undefined || (typeof parentContainer !== 'object')) {
    throw new SchemaError(fpm('Not a valid container', state.path));
  }
  if (!property.state.schema?.isImplicit) {
    parentContainer[property.key] = property.value;

    if (!property.state.isUnion) {
      property.state.isProcessed = true;
    }
  }
}

/**
 * @param {TraversalState} state
 * @param {TraversalState} propertyState
 * @returns {Promise<symbol|void>}
 */
export async function propertyEnd(state, propertyState) {
  if (propertyState.value === undefined || propertyState.value === null) {
    return;
  }
  let parentContainer = state.pending ?? state.value;

  if (parentContainer === null) {
    // oops, we shouldn't even be here!
    return TraversalControl.STOP;
  }
  if (parentContainer === undefined || (typeof parentContainer !== 'object')) {
    throw new SchemaError(fpm('Not a valid container', state.path));
  }

  const propertyName = propertyState.name;
  const propertyKey = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;

  if (!propertyState.schema?.isImplicit) {
    parentContainer[propertyKey] = propertyState.value;

    if (!propertyState.isUnion) {
      propertyState.isProcessed = true;
    }
  }

}