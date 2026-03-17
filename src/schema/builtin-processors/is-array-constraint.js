import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$is-array`
 *
 * Validates that the input is a valid array.
 *
 * See `$array` for looser array handling that accepts values that can be normalized as arrays.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_ARRAY_CONSTRAINT = {
  keyword: 'is-array',
  process: (value, _, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError('Must be an array');
    }
    return value;
  },
  description: ''
};
