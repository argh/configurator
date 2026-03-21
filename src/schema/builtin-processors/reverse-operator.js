import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$reverse`
 *
 * Returns a new array with elements in reverse order. Non-mutating.
 * Throws if the input is not an array.
 *
 * **Input**: `[1, 2, 3]` → **Output**: `[3, 2, 1]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const REVERSE_OPERATOR = {
  keyword: 'reverse',
  process: (value, _target, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$reverse requires an array, got ${formatValue(value)}`, {location});
    }
    return [...value].reverse();
  }
};
