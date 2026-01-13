import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$integer`
 *
 * Validates that a value is an integer (whole number with no decimal places).
 * Accepts numeric values and numeric strings, converting them to integers if valid.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('number').validator('$integer')
 *
 * // In a schema property
 * Schema.create('object', {
 *   itemCount: Schema.create('number').validator('$integer'),
 *   pageNumber: Schema.create('number').validator('$integer')
 * })
 *
 * // Combined with range validation
 * Schema.create('number')
 *   .validator('$integer')
 *   .validator({$range: {min: 0, max: 100}})
 * ```
 *
 * **Valid values**: `42`, `0`, `-10`, `"123"`, `1.0` (converts to `1`)
 *
 * **Invalid values**: `3.14`, `"12.5"`, `NaN`, `Infinity`, `"abc"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const INTEGER_CONSTRAINT = {
  keyword: 'integer',
  processor: (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number');
    }
    if (num !== Math.floor(num)) {
      throw new ConstraintError('Must be an integer');
    }
    return num;
  }
};
