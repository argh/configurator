import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$entries`
 *
 * Returns the enumerable own properties of an object as an array of `[key, value]` pairs,
 * matching the output of `Object.entries()`.
 *
 * The resulting array can be reconstructed back into an object with `$object`.
 *
 * Throws if the input is not a plain object.
 *
 * **Input**: `{a: 1, b: 2}` → **Output**: `[['a', 1], ['b', 2]]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const ENTRIES_OPERATOR = {
  keyword: 'entries',
  process: (value, _target, location) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConstraintError(`$entries requires a plain object, got ${formatValue(value)}`, {location});
    }
    return Object.entries(value);
  }
};
