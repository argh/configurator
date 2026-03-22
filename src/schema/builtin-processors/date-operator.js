import { ConstraintError } from '../schema-errors.js';
import { parseDate } from '../helpers/parse-date.js';

/**
 * Reassemble a date from a `$date-object` field object.
 * @param {{year:number, month:number, day:number, hour?:number, minute?:number, second?:number, ms?:number, zone?:string}} obj
 * @returns {Date}
 */
function fromDateObject(obj) {
  const {year, month, day, hour = 0, minute = 0, second = 0, ms = 0, zone = 'utc'} = obj;
  if (zone === 'local') {
    return new Date(year, month - 1, day, hour, minute, second, ms);
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
}

/**
 * ## $date
 *
 * Normalize the input value as a Date.  Accepts strings, numbers, Date instances, and
 * date-field objects produced by `$date-object`.
 *
 * - `'now'` — returns the current timestamp
 * - `'+1h'`, `'-30m'`, etc. — relative offsets from now
 * - ISO strings and numeric epoch values are parsed automatically
 * - `{year, month, day, ...zone}` — reassembled from a `$date-object` output
 *
 * Output type is inferred from the schema's `type` option:
 * - `'string'` → ISO string
 * - `'number'` → epoch milliseconds
 * - otherwise → `Date` instance
 *
 * See `$is-date` for strict Date validation.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const DATE_OPERATOR = {
  keyword: 'date',

  process: (value, _target, location) => {
    // Accept date-field objects produced by $date-object
    if (typeof value === 'object' && value !== null && !(value instanceof Date)
        && Number.isInteger(value.year) && Number.isInteger(value.month)) {
      const date = fromDateObject(value);
      if (isNaN(date.getTime())) {
        throw new ConstraintError(`Invalid date object: ${JSON.stringify(value)}`);
      }
      if (location.schema.options.type === 'string') return date.toISOString();
      if (location.schema.options.type === 'number') return date.getTime();
      return date;
    }
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
