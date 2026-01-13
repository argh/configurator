import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$range`
 *
 * Validates that a numeric value falls within the specified range (inclusive).
 * Can specify minimum, maximum, or both bounds.
 *
 * @example
 * ```javascript
 * // Require value between 1 and 100 (inclusive)
 * Schema.create('number').validator({$range: {min: 1, max: 100}})
 *
 * // At least 0 (no upper bound)
 * Schema.create('number').validator({$range: {min: 0}})
 *
 * // At most 100 (no lower bound)
 * Schema.create('number').validator({$range: {max: 100}})
 *
 * // Port number example
 * Schema.create('object', {
 *   port: Schema.create('number').validator({$range: {min: 1, max: 65535}})
 * })
 *
 * // Percentage value
 * Schema.create('number').validator({$range: {min: 0, max: 100}})
 * ```
 *
 * **Parameters**:
 * - `min` (number, optional): Minimum value (inclusive). If omitted, no lower bound.
 * - `max` (number, optional): Maximum value (inclusive). If omitted, no upper bound.
 *
 * **Valid values**: Numbers within the specified range (both min and max are inclusive)
 *
 * **Invalid values**: Non-numeric values, numbers below min, numbers above max
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const RANGE_CONSTRAINT = {
  keyword: 'range',
  builder: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$range requires an object with min/max properties');
    }
    const { min, max } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          throw new ConstraintError('Value must be a number');
        }
        if (min !== undefined && num < min) {
          throw new ConstraintError(`Value must be at least ${min}`);
        }
        if (max !== undefined && num > max) {
          throw new ConstraintError(`Value must be at most ${max}`);
        }
        return value;
      },
      description: min !== undefined && max !== undefined
                   ? `${min}-${max}`
                   : min !== undefined
                     ? `≥${min}`
                     : max !== undefined
                       ? `≤${max}`
                       : undefined
    };
  }
};
