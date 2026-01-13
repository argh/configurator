/**
 * **Processor**: `$round`
 *
 * Rounds a numeric value to the nearest integer or to a specified number of decimal places.
 * Safe to use in normalize phase (non-throwing). Non-numeric values pass through unchanged.
 *
 * @example
 * ```javascript
 * // Round to nearest integer (default)
 * Schema.create('number').normalizer('$round')
 *
 * // Round to 2 decimal places (e.g., currency)
 * Schema.create('number').normalizer({$round: 2})
 *
 * // Round to 3 decimal places in a transform
 * Schema.create('number').transformer({$round: 3})
 *
 * // Price field example
 * Schema.create('object', {
 *   price: Schema.create('number')
 *     .normalizer('$number')
 *     .normalizer({$round: 2})
 * })
 * ```
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
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const ROUND_OPERATOR = {
  keyword: 'round',
  builder: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.round(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `round(${precision})` : 'round'
    };
  }
};
