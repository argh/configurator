import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $flatten
 *
 * Returns a new array with sub-array elements flattened to the specified depth.
 * Throws if the input is not an array.
 *
 * ### Parameters
 * - `depth` (number, optional, default `1`): The depth to flatten. Use `Infinity` to flatten completely.
 *
 * ### Example
 * ```js
 * // Flatten one level of nesting
 * new Schema('array').transformer('$flatten')
 * // [[1, 2], [3, 4]] → [1, 2, 3, 4]
 *
 * // Flatten all levels
 * new Schema('array').transformer({$flatten: {depth: Infinity}})
 * // [1, [2, [3, [4]]]] → [1, 2, 3, 4]
 *
 * // Flatten exactly 2 levels
 * new Schema('array').transformer({$flatten: {depth: 2}})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const FLATTEN_OPERATOR = {
  keyword: 'flatten',
  parameters: [ { parameter: 'depth', default: 1 } ],

  process: (value, _target, location, options) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$flatten requires an array, got ${formatValue(value)}`, {location});
    }
    const depth = options.args?.['depth'] ?? 1;
    return value.flat(depth);
  }
};
