import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$numeric`
 *
 * Validates that a string contains only numeric digits (0-9).
 * The value is coerced to a string before validation, so numbers are accepted
 * but must not contain decimal points, signs, or scientific notation.
 *
 * **Valid values**: `"12345"`, `"0"`, `"999"`, `123` (coerced to `"123"`)
 *
 * **Invalid values**: `"12.34"`, `"-5"`, `"+10"`, `"1e5"`, `"abc"`, `"12a34"`, `""`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const NUMERIC_CONSTRAINT = {
  keyword: 'numeric',
  process: (value) => {
    const v = `${value}`;
    const numericRegex = /^[0-9]+$/;
    if (!numericRegex.test(v)) {
      throw new ConstraintError('Must contain only digits');
    }
    return value;
  }
};
