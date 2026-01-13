import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$number`
 *
 * Validates and coerces values to numbers. Accepts numeric strings, integers, and floats.
 * Rejects NaN, Infinity, and non-numeric values.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$number')
 *
 * // In a schema property
 * Schema.create('object', {
 *   timeout: Schema.create('string').normalizer('$number')
 * })
 *
 * // Coerce environment variables to numbers
 * Schema.create('object', {
 *   port: Schema.create('string')
 *     .normalizer('$number')
 *     .validator({$range: {min: 1, max: 65535}})
 * })
 * ```
 *
 * **Valid values**: `"123"` → `123`, `"3.14"` → `3.14`, `"-42"` → `-42`, `0` → `0`, `42.5` → `42.5`
 *
 * **Invalid values**: `"abc"`, `"123abc"`, `""`, `null`, `undefined`, `NaN`, `Infinity`, `-Infinity`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NUMBER_CONSTRAINT = {
  keyword: 'number',
  processor: (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number');
    }
    return num;
  }
};
