import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $sort
 *
 * Returns a new sorted array. Non-mutating. Numbers are compared numerically;
 * all other values are compared lexicographically as strings.
 * Throws if the input is not an array.
 *
 * ### Parameters
 * - `key` (string|null, optional, default `null`): Object property key to sort by.
 * - `direction` (`'asc'`|`'desc'`, optional, default `'asc'`): Sort direction.
 *
 * ### Example
 * ```js
 * // Sort an array of numbers in ascending order
 * new Schema('array').transformer('$sort')
 * // [3, 1, 2] → [1, 2, 3]
 *
 * // Sort strings in descending order
 * new Schema('array').transformer({$sort: {direction: 'desc'}})
 *
 * // Sort an array of objects by a property
 * new Schema('array').transformer({$sort: {key: 'name'}})
 * // [{name: 'Charlie'}, {name: 'Alice'}] → [{name: 'Alice'}, {name: 'Charlie'}]
 *
 * // Sort objects by a numeric property descending
 * new Schema('array').transformer({$sort: {key: 'score', direction: 'desc'}})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const SORT_OPERATOR = {
  keyword: 'sort',
  parameters: [ { parameter: 'key', default: null }, { parameter: 'direction', default: 'asc' } ],

  process: (value, _target, location, options) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$sort requires an array, got ${formatValue(value)}`, {location});
    }
    const key = options.args?.['key'] ?? null;
    const direction = options.args?.['direction'] ?? 'asc';

    const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number')
      ? a - b
      : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;

    const sorted = [...value].sort(key ? (a, b) => cmp(a[key], b[key]) : cmp);
    return direction === 'desc' ? sorted.reverse() : sorted;
  }
};
