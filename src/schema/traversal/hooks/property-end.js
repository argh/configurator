import { TraversalControl } from '../traversal-hooks.js';
import { SchemaError } from '../../../errors.js';
import { fpm } from '../../helpers/fpm.js';
import { TraversalState } from '../traversal-state.js';

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
    // try to be helpful
    let stringifiedParentContainer = `${parentContainer}`;
    if (stringifiedParentContainer.length > 20) {
      stringifiedParentContainer = stringifiedParentContainer.slice(0, 20) + '...'
    }
    const message = stringifiedParentContainer.length?
                    `<<${stringifiedParentContainer}>> is not a valid container (set opaque option?)`
                    : 'Not a valid container (set opaque option?)'

    throw new SchemaError(fpm(message, state.path));
  }

  if (propertyState.schema?.isImplicit) {
    propertyState.isProcessed = true;
  }
  else {
    const propertyName = propertyState.name;
    const propertyKey = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;

    if (parentContainer[propertyKey] !== propertyState.value) {
      parentContainer[propertyKey] = propertyState.value;
    }

    if (!propertyState.isUnion) {
      propertyState.isProcessed = true;
    }
  }

}