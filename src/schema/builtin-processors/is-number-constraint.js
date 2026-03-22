import { ConstraintError } from '../schema-errors.js';

/**
 * ## $is-number
 *
 * Validates that the input is a valid number.
 *
 * See `$number` for looser number validation that accepts values that can be normalized as numbers.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_NUMBER_CONSTRAINT = {
  keyword: 'is-number',
  process: (value) => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new ConstraintError('Must be a number');
    }
    return value;
  },
  description: ''
};
