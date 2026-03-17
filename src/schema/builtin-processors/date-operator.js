import { ConstraintError } from '../schema-errors.js';
import { parseDate } from '../helpers/parse-date.js';

/**
 * **Processor**: `$date`
 *
 * Attempt to normalize the input value as a date.  Tries to be friendly to the underlying schema;
 * built-in strings and numbers get the appropriate type of output for their representation.
 *
 * See `$is-date` for strict Date validation.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const DATE_OPERATOR = {
  keyword: 'date',

  process: (value, _target, location) => {
    if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
      throw new ConstraintError(`Invalid input for date: ${value}`);
    }
    const date = parseDate(value);

    if (location.schema.options.type === 'string') {
      return date.toISOString();
    }
    else if (location.schema.options.type === 'number') {
      return date.getTime();
    }
    else {
      return date;
    }
  }
};
