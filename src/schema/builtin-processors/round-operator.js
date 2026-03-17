/**
 * **Processor**: `$round`
 *
 * Rounds a numeric value to the nearest integer or to a specified number of decimal places.
 * Safe to use in normalize phase (non-throwing). Non-numeric values pass through unchanged.
 *
 * **Parameters**:
 * - `precision` (number, optional): Number of decimal places. Defaults to 0 (integer rounding).
 *
 * **Examples**:
 * - `3.7` with precision 0 → `4`
 * - `3.14159` with precision 2 → `3.14`
 * - `123.456` with precision 1 → `123.5`
 * - `"not a number"` → `"not a number"` (passes through unchanged)
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const ROUND_OPERATOR = {
  keyword: 'round',
  parameters: [ { parameter: 'precision', default: 0 } ],

  process: (value, _target, _location, options) => {
    const precision = options.args.precision;
    const multiplier = Math.pow(10, precision);
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return value; // Pass through non-numeric values unchanged
    }
    return Math.round(num * multiplier) / multiplier;
  },
  /*
      description: precision > 0 ? `round(${precision})` : 'round'
    };
  }

   */
};
