import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$flatten`
 *
 * Returns a new array with sub-array elements flattened to the specified depth.
 * Throws if the input is not an array.
 *
 * **Parameters**:
 * - `depth` (number, optional, default `1`): The depth to flatten. Use `Infinity` to flatten completely.
 *
 * **Input**: `[[1, 2], [3, [4]]]` → **Output** (depth 1): `[1, 2, 3, [4]]`
 * **Input**: `[[1, [2, [3]]]]` with `{$flatten: Infinity}` → **Output**: `[1, 2, 3]`
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
