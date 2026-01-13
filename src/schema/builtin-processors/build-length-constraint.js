import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$length`
 *
 * Validates that the length of a string or array falls within specified bounds (inclusive).
 * Can specify minimum, maximum, exact length, or any combination of min/max.
 *
 * For strings, length is measured in characters. For arrays, length is measured in elements.
 *
 * @example
 * ```javascript
 * // Require string between 3 and 20 characters
 * Schema.create('string').validator({$length: {min: 3, max: 20}})
 *
 * // Require array with at least 1 element
 * Schema.create('array').validator({$length: {min: 1}})
 *
 * // Require exactly 5 elements
 * Schema.create('array').validator({$length: {exact: 5}})
 *
 * // Username with length constraints
 * Schema.create('object', {
 *   username: Schema.create('string').validator({$length: {min: 3, max: 32}}),
 *   tags: Schema.create('array').validator({$length: {min: 1, max: 10}})
 * })
 *
 * // At most 100 characters (no lower bound)
 * Schema.create('string').validator({$length: {max: 100}})
 * ```
 *
 * **Parameters**:
 * - `min` (number, optional): Minimum length (inclusive). If omitted, no lower bound.
 * - `max` (number, optional): Maximum length (inclusive). If omitted, no upper bound.
 * - `exact` (number, optional): Exact required length. If specified, min/max are ignored.
 *
 * **Valid values**:
 * - With `{min: 3, max: 10}`: strings "abc" to "abcdefghij", arrays with 3-10 elements
 * - With `{exact: 5}`: string "hello", array [1,2,3,4,5]
 *
 * **Invalid values**:
 * - With `{min: 3, max: 10}`: string "ab" (too short), array with 11 elements (too long)
 * - With `{exact: 5}`: string "hi" (wrong length), array [1,2,3] (wrong length)
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const LENGTH_CONSTRAINT = {
  keyword: 'length',
  builder: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$length requires an object with min/max/exact properties');
    }
    const { min, max, exact } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        const length = Array.isArray(value) ? value.length : String(value).length;
        const unit = Array.isArray(value) ? 'elements' : 'characters';

        if (exact !== undefined && length !== exact) {
          throw new ConstraintError(`Length must be exactly ${exact} ${unit}`);
        }
        if (min !== undefined && length < min) {
          throw new ConstraintError(`Length must be at least ${min} ${unit}`);
        }
        if (max !== undefined && length > max) {
          throw new ConstraintError(`Length must be at most ${max} ${unit}`);
        }
        return value;
      },
      description: exact !== undefined
                   ? `len=${exact}`
                   : min !== undefined && max !== undefined
                     ? `len=${min}-${max}`
                     : min !== undefined
                       ? `len≥${min}`
                       : max !== undefined
                         ? `len≤${max}`
                         : undefined
    };
  }
};
