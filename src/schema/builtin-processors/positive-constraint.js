import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$positive`
 *
 * Validates that a numeric value is positive (greater than 0).
 * Input must already be a number; use `$number` in a prior normalizer if coercion from string is needed.
 *
 * **Valid values**: `1`, `0.1`, `42`, `3.14159`
 *
 * **Invalid values**: `0`, `-1`, `-42.5`, `NaN`, `Infinity`, any non-number type
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const POSITIVE_CONSTRAINT = {
  keyword: 'positive',
  process: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new ConstraintError('Must be a positive number');
    }
    return value;
  }
};
