import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$unique`
 *
 * Returns a new array with duplicate values removed, preserving insertion order
 * of first occurrences. Uses identity-based (`Set`) deduplication.
 * Throws if the input is not an array.
 *
 * **Input**: `[1, 2, 1, 3, 2]` → **Output**: `[1, 2, 3]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const UNIQUE_OPERATOR = {
  keyword: 'unique',
  process: (value, _target, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$unique requires an array, got ${formatValue(value)}`, {location});
    }
    return [...new Set(value)];
  }
};
