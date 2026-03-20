import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$keys`
 *
 * Returns the enumerable own property keys of an object as an array of strings.
 * Throws if the input is not a plain object.
 *
 * **Input**: `{a: 1, b: 2}` → **Output**: `['a', 'b']`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const KEYS_OPERATOR = {
  keyword: 'keys',
  process: (value, _target, location) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConstraintError(`$keys requires a plain object, got ${formatValue(value)}`, {location});
    }
    return Object.keys(value);
  }
};
