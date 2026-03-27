import { ConstraintError } from '../schema-errors.js';
import { EMPTY } from '../constants.js';

/**
 * ## $number
 *
 * Validates and coerces values to numbers. Accepts numeric strings, integers, and floats.
 * Rejects NaN, Infinity, and non-numeric values.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const NUMBER_OPERATOR = {
  keyword: 'number',
  process: (value) => {
    if (value === EMPTY) {
      return 0;
    }
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number or convertible to a number');
    }
    return num;
  }
};
