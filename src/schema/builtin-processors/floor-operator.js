/**
 * **Processor**: `$floor`
 *
 * Rounds a numeric value down to the specified number of decimal places.
 * Non-numeric values are passed through unchanged. Safe to use in normalize phase (non-throwing).
 *
 * **Parameters**:
 * - `precision` (number, optional): Number of decimal places to preserve. Defaults to 0 (round to integer).
 *
 * **Input/Output Examples**:
 * - `$floor`: `3.7` → `3`, `9.99` → `9`, `-2.3` → `-3`
 * - `{$floor: 2}`: `3.14159` → `3.14`, `99.999` → `99.99`, `5.1` → `5.1`
 * - `{$floor: 1}`: `3.76` → `3.7`, `9.01` → `9.0`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const FLOOR_OPERATOR = {
  keyword: 'floor',
  parameters: [ { parameter: 'precision', default: 0 } ],

  process: (value, _target, _location, options) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return value; // Pass through non-numeric values unchanged
    }
    const precision = options.args.precision;
    const multiplier = Math.pow(10, precision);

    return Math.floor(num * multiplier) / multiplier;
  }
};
