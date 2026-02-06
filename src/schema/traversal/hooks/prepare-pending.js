import { TraversalControl } from '../traversal-hooks.js';
import { TraversalState } from '../traversal-state.js';
import { SchemaError } from '../../../errors.js';
import { fpm } from '../../helpers/fpm.js';

/**
 * @param {TraversalState} state
 * @returns {Promise<symbol|void>}
 */
export async function preparePending(state) {
  if (state.isContainer) {
    if (!state.isMandatory) {
      // We lazily create containers only when we know we need to store a property value
      return TraversalControl.STOP;
    }

    if (state.pending !== undefined) {
      // will will use the container in progress
    }
    else if (state.value !== undefined && state.isIncremental) {
      state.pending = state.value;
    }
    else if (state.value !== undefined && state.isOpaque) {
      throw new SchemaError('Value already processed', {location: state.location});
    }
    else {
      // create an empty container to hold children

      const configuration = state.context.getValue();
      state.pending = await state.schema?._normalizeValue(true, configuration, state.location, {traversalState: state});
    }
  }
  else {
    // presumably normalized via the normalizeInput hook
    state.pending = state.input;
  }
}