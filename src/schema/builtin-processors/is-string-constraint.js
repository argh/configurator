import { ConstraintError } from '../schema-errors.js';

/**
 * ## $is-string
 *
 * Validates that the input is a valid string.
 *
 * See `$string` for looser validation that accepts values that can be normalized as strings.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_STRING_CONSTRAINT = {
  keyword: 'is-string',
  process: (value) => {
    if (typeof value === 'string') {
      return value;
    }
    throw new ConstraintError('Must be a string');
  },
  description: ''
};
