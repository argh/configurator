import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$numeric`
 *
 * Validates that a string contains only numeric digits (0-9).
 * The value is coerced to a string before validation, so numbers are accepted
 * but must not contain decimal points, signs, or scientific notation.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$numeric')
 *
 * // Validate numeric ID strings
 * Schema.create('object', {
 *   accountId: Schema.create('string').validator('$numeric')
 * })
 *
 * // Can also validate number inputs (integers only)
 * Schema.create('number').validator('$numeric')
 * ```
 *
 * **Valid values**: `"12345"`, `"0"`, `"999"`, `123` (coerced to `"123"`)
 *
 * **Invalid values**: `"12.34"`, `"-5"`, `"+10"`, `"1e5"`, `"abc"`, `"12a34"`, `""`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NUMERIC_CONSTRAINT = {
  keyword: 'numeric',
  processor: (value) => {
    const v = `${value}`;
    const numericRegex = /^[0-9]+$/;
    if (!numericRegex.test(v)) {
      throw new ConstraintError('Must contain only digits');
    }
    return value;
  }
};
