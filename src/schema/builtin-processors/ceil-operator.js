
/** @import {ValueProcessorDefinition} from '../value-processor/value-processor.js' */

/**
 * ## $ceil
 *
 * Rounds a numeric value up to the nearest integer or specified decimal precision.
 * Non-numeric values are passed through unchanged. Safe to use in normalize phase (non-throwing).
 *
 * ### Parameters
 * - `precision` (number, optional): Number of decimal places to preserve. Defaults to 0 (round to integer).
 *
 * ### Example
 * ```js
 * // Round up to the nearest integer
 * new Schema('number').transformer('$ceil')
 * // 3.14 → 4, 9.01 → 10
 *
 * // Round up to 2 decimal places
 * new Schema('number').transformer({$ceil: {precision: 2}})
 * // 3.14159 → 3.15
 *
 * // Round up memory usage to the nearest MB boundary
 * new Schema('object', {
 *   memoryMB: new Schema('number').transformer({$ceil: {precision: 0}}),
 * })
 * ```
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
