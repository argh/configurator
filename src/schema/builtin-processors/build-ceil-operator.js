/**
 * **Processor**: `$ceil`
 *
 * Rounds a numeric value up to the nearest integer or specified decimal precision.
 * Non-numeric values are passed through unchanged. Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Round up to integer
 * Schema.create('number').normalizer({$ceil: 0})
 *
 * // Round up to 2 decimal places
 * Schema.create('number').normalizer({$ceil: 2})
 *
 * // In a schema property (price rounding)
 * Schema.create('object', {
 *   price: Schema.create('number').normalizer({$ceil: 2})
 * })
 * ```
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
 * @type {import("../types.js").ValueProcessorDefinition}
 */
export const CEIL_OPERATOR = {
  keyword: 'ceil',
  builder: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.ceil(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `ceil(${precision})` : 'ceil'
    };
  }
};
