import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$positive`
 *
 * Validates that a numeric value is positive (greater than 0).
 * The value is coerced to a number before validation.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('number').validator('$positive')
 *
 * // In a schema property
 * Schema.create('object', {
 *   quantity: Schema.create('number').validator('$positive'),
 *   price: Schema.create('number').validator('$positive')
 * })
 *
 * // Combined with range validation
 * Schema.create('number')
 *   .validator('$positive')
 *   .validator({$range: {max: 100}})
 * ```
 *
 * **Valid values**: `1`, `0.1`, `42`, `3.14159`, `"5"` (coerced to 5)
 *
 * **Invalid values**: `0`, `-1`, `-42.5`, `"0"`, `"-10"`, `NaN`, `Infinity`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const POSITIVE_CONSTRAINT = {
  keyword: 'positive',
  processor: (value) => {
    const num = Number(value);
    if (!(Number.isFinite(num) && num > 0)) {
      throw new ConstraintError('Must be a positive number');
    }
    return num;
  }
};
