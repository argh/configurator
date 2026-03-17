import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$negative`
 *
 * Validates that a numeric value is negative (less than 0).
 * Input must already be a number; use `$number` in a prior normalizer if coercion from string is needed.
 *
 * **Valid values**: `-1`, `-42`, `-0.5`, `-999.99`
 *
 * **Invalid values**: `0`, `1`, `42`, `NaN`, `Infinity`, `-Infinity`, any non-number type
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const NEGATIVE_CONSTRAINT = {
  keyword: 'negative',
  process: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value >= 0) {
      throw new ConstraintError('Must be a negative number');
    }
    return value;
  }
};
