
/** @import {ValueProcessorDefinition} from '../value-processor/value-processor.js' */

/**
 * **Processor**: `$ceil`
 *
 * Rounds a numeric value up to the nearest integer or specified decimal precision.
 * Non-numeric values are passed through unchanged. Safe to use in normalize phase (non-throwing).
 *
 * **Parameters**:
 * - `precision` (number, optional): Number of decimal places to preserve. Defaults to 0 (round to integer).
 *
 * **Examples**:
 * - `{$ceil: 0}` with `3.14` → `4`
 * - `{$ceil: 2}` with `3.14159` → `3.15`
 * - `{$ceil: 1}` with `1.01` → `1.1`
 * - `{$ceil: 0}` with `"not a number"` → `"not a number"` (unchanged)
 *
 *
 *
 * The schema is transforming a complex object down to a single value.
 *
 * schema sees:
 * {
 *    handlers: {
 *      validators: [
 *        {$ceil: {precision: 0}}
 *      ]
 *    }
 * }
 *
 * The "0" is of type argument processor, gets compiled to an Executor
 * {precision: executor} is of type object containing wildcard keys and processor values
 * validators is an array of processors
 *   {$ceil: args} is looked up
 *
 * @type {ValueProcessorDefinition}
 */
export const CEIL_OPERATOR = {
  keyword: 'ceil',
  parameters: [ { parameter: 'precision', default: 0 } ],

  process: (value, _target, _location, options) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return value; // Pass through non-numeric values unchanged
    }
    const precision = options.args['precision'];
    const multiplier = Math.pow(10, precision);
    return Math.ceil(num * multiplier) / multiplier;
  }
}
