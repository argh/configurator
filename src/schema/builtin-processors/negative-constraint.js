import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$negative`
 *
 * Validates that a numeric value is negative (less than 0).
 * Coerces the input to a number before checking.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('number').validator('$negative')
 *
 * // Validate temperature below freezing
 * Schema.create('object', {
 *   temperatureCelsius: Schema.create('number').validator('$negative')
 * })
 *
 * // Combined with range for specific negative range
 * Schema.create('number')
 *   .validator('$negative')
 *   .validator({$range: {min: -100, max: -1}})
 * ```
 *
 * **Valid values**: `-1`, `-42`, `-0.5`, `-999.99`, `"-123"` (coerced to number)
 *
 * **Invalid values**: `0`, `1`, `42`, `"abc"`, `NaN`, `Infinity`, `-Infinity`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NEGATIVE_CONSTRAINT = {
  keyword: 'negative',
  processor: (value) => {
    const num = Number(value);
    if (!(Number.isFinite(num) && num < 0)) {
      throw new ConstraintError('Must be a negative number');
    }
    return num;
  }
};
