import { ConstraintError, ResolverError } from '../schema-errors.js';

/**
 * ## $range
 *
 * Validates that a numeric value falls within the specified range (inclusive).
 * Can specify minimum, maximum, or both bounds.
 *
 * ### Parameters
 * - `min` (number, optional): Minimum value (inclusive). If omitted, no lower bound.
 * - `max` (number, optional): Maximum value (inclusive). If omitted, no upper bound.
 *
 * ### Example
 * ```js
 * // Object form with named parameters
 * new Schema('number').validator({$range: {min: 1, max: 100}})
 *
 * // Array form [min, max]
 * new Schema('number').validator({$range: [1, 65535]})
 *
 * // Only a lower bound (percentage, must be non-negative)
 * new Schema('number').validator({$range: {min: 0}})
 *
 * // Only an upper bound
 * new Schema('number').validator({$range: {max: 255}})
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const RANGE_CONSTRAINT = {
  keyword: 'range',
  parameters: [ { parameter: 'min' }, { parameter: 'max'}, { parameter: 'exact'} ],

  process: (value, _target, _location, options) => {
    const { min, max } = options.args;

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
  describe: (args) => {

    if (!args) {
      return undefined;  // should never happen
    }

    const minProcessor = (Array.isArray(args)? args[0] : args.min);
    const maxProcessor = (Array.isArray(args)? args[1] : args.max);

    const min = minProcessor?.description;
    const max = maxProcessor?.description;

    return min !== undefined && max !== undefined
           ? `${min}-${max}`
           : min !== undefined
             ? `≥${min}`
             : max !== undefined
               ? `≤${max}`
               : undefined
  }
};
