import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$integer`
 *
 * Validates that a numeric value is an integer (no fractional part).
 * Input must already be a number; use `$number` in a prior normalizer if coercion from string is needed.
 *
 * **Valid values**: `42`, `0`, `-10`, `1.0` (same as `1`)
 *
 * **Invalid values**: `3.14`, `NaN`, `Infinity`, any non-number type
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const INTEGER_CONSTRAINT = {
  keyword: 'integer',
  process: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConstraintError('Must be a finite number');
    }
    if (!Number.isInteger(value)) {
      throw new ConstraintError('Must be an integer');
    }
    return value;
  }
};
