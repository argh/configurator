import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$values`
 *
 * Returns the enumerable own property values of an object as an array.
 * Throws if the input is not a plain object.
 *
 * **Input**: `{a: 1, b: 2}` → **Output**: `[1, 2]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const VALUES_OPERATOR = {
  keyword: 'values',
  process: (value, _target, location) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConstraintError(`$values requires a plain object, got ${formatValue(value)}`, {location});
    }
    return Object.values(value);
  }
};
