import { ConstraintError } from '../schema-errors.js';
import { stringify } from '../helpers/stringify.js';

/**
 * **Processor**: `$string`
 *
 * Ensures value is a string, stringifying as necessary.  Everything other than null and undefined can be converted.
 *
 * See `$is-string` for strict string validation.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const STRING_OPERATOR = {
  keyword: 'string',
  process: (value) => {
    if (typeof value === 'string') {
      return value;
    }
    else if (value === null || value === undefined) {
      throw new ConstraintError(`Invalid string`, {value})
    }
    else if (typeof value === 'object') {
      return stringify(value);
    }
    else {
      return String(value)
    }
  }
};
