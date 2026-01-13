/**
 * **Processor**: `$floor`
 *
 * Rounds a numeric value down to the specified number of decimal places.
 * Non-numeric values are passed through unchanged. Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Round down to nearest integer
 * Schema.create('number').normalizer({$floor: 0})
 *
 * // Round down to 2 decimal places (e.g., for currency)
 * Schema.create('object', {
 *   price: Schema.create('number').normalizer({$floor: 2})
 * })
 *
 * // Round down to 1 decimal place
 * Schema.create('number').normalizer({$floor: 1})
 *
 * // Combined with other processors
 * Schema.create('string')
 *   .normalizer('$number')  // Convert string to number
 *   .normalizer({$floor: 2})  // Then floor to 2 decimals
 * ```
 *
 * **Parameters**:
 * - `precision` (number, optional): Number of decimal places to preserve. Defaults to 0 (round to integer).
 *
 * **Input/Output Examples**:
 * - `{$floor: 0}`: `3.7` → `3`, `9.99` → `9`, `-2.3` → `-3`
 * - `{$floor: 2}`: `3.14159` → `3.14`, `99.999` → `99.99`, `5.1` → `5.1`
 * - `{$floor: 1}`: `3.76` → `3.7`, `9.01` → `9.0`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FLOOR_OPERATOR = {
  keyword: 'floor',
  builder: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.floor(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `floor(${precision})` : 'floor'
    };
  }
};
