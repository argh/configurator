import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $date-object
 *
 * Expands a Date into a plain object with named calendar fields.
 *
 * - `'$date-object'` or `{'$date-object': 'utc'}` — UTC fields (default)
 * - `{'$date-object': 'local'}` — local-timezone fields
 *
 * Output shape: `{year, month, day, hour, minute, second, ms, zone}`
 * where `month` is 1–12 (not 0-based), and `zone` is `'utc'` or `'local'`.
 *
 * The output is accepted by `$date` for round-trip reassembly.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const DATE_OBJECT_OPERATOR = {
  keyword: 'date-object',
  parameters: [{parameter: 'zone'}],

  process: (value, _target, location, options) => {
    if (!(value instanceof Date)) {
      throw new ConstraintError(`$date-object requires a Date, got ${formatValue(value)}`, {location});
    }
    const zone = options.args['zone'] ?? 'utc';
    if (zone !== 'utc' && zone !== 'local') {
      throw new ConstraintError(`$date-object zone must be 'utc' or 'local', got ${formatValue(zone)}`, {location});
    }
    if (zone === 'local') {
      return {
        year:   value.getFullYear(),
        month:  value.getMonth() + 1,
        day:    value.getDate(),
        hour:   value.getHours(),
        minute: value.getMinutes(),
        second: value.getSeconds(),
        ms:     value.getMilliseconds(),
        zone:   'local',
      };
    }
    return {
      year:   value.getUTCFullYear(),
      month:  value.getUTCMonth() + 1,
      day:    value.getUTCDate(),
      hour:   value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
      ms:     value.getUTCMilliseconds(),
      zone:   'utc',
    };
  }
};
