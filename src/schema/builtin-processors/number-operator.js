import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$number`
 *
 * Validates and coerces values to numbers. Accepts numeric strings, integers, and floats.
 * Rejects NaN, Infinity, and non-numeric values.
 *
 * **Valid values**: `"123"` → `123`, `"3.14"` → `3.14`, `"-42"` → `-42`, `0` → `0`, `42.5` → `42.5`
 *
 * **Invalid values**: `"abc"`, `"123abc"`, `""`, `null`, `undefined`, `NaN`, `Infinity`, `-Infinity`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const NUMBER_OPERATOR = {
  keyword: 'number',
  process: (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number or convertible to a number');
    }
    return num;
  }
};
