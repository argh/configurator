import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $unique
 *
 * Returns a new array with duplicate values removed, preserving insertion order
 * of first occurrences. Uses identity-based (`Set`) deduplication.
 * Throws if the input is not an array.
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
