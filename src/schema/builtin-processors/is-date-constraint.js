import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$is-date`
 *
 * Validates that the input is a valid date.
 *
 * See `$date` for looser date handling that accepts values that can be normalized as dates.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_DATE_CONSTRAINT = {
  keyword: 'is-date',
  process: (value) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }
    throw new ConstraintError(`Invalid date: ${formatValue(value)}`)
  },
  description: ''
};
