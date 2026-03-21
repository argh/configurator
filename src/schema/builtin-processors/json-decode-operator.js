import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$json-decode`
 *
 * Parses a JSON string into a value.
 * Throws if the input is not a string or is not valid JSON.
 *
 * **Input**: `'{"a":1,"b":[2,3]}'` → **Output**: `{a: 1, b: [2, 3]}`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const JSON_DECODE_OPERATOR = {
  keyword: 'json-decode',
  process: (value, _target, location) => {
    if (typeof value !== 'string') {
      throw new ConstraintError(`$json-decode requires a string, got ${formatValue(value)}`, {location});
    }
    try {
      return JSON.parse(value);
    }
    catch (error) {
      throw new ConstraintError(`$json-decode: invalid JSON — ${error.message}`, {location, cause: error});
    }
  }
};
