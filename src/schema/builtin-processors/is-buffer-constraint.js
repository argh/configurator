import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$is-buffer`
 *
 * Validates that the input is a Node.js Buffer.
 *
 * See `$buffer` for looser normalization that accepts values that can be converted to a Buffer.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_BUFFER_CONSTRAINT = {
  keyword: 'is-buffer',
  process: (value) => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    throw new ConstraintError('Must be a Buffer');
  },
  description: ''
};
