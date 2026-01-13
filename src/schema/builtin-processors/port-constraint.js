import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$port`
 *
 * Validates that a value is a valid TCP/UDP port number (1-65535).
 * Accepts numeric values or strings that can be converted to numbers.
 * Returns the value as a number.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('number').validator('$port')
 *
 * // Accept string or number input
 * Schema.create('string').normalizer('$number').validator('$port')
 *
 * // In a schema property
 * Schema.create('object', {
 *   serverPort: Schema.create('number').validator('$port'),
 *   httpsPort: Schema.create('number').validator('$port').default(443)
 * })
 * ```
 *
 * **Valid values**: `80`, `443`, `8080`, `3000`, `"8080"` (string), `65535`
 *
 * **Invalid values**: `0`, `-1`, `65536`, `100000`, `3.14`, `"abc"`, `null`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const PORT_CONSTRAINT = {
  keyword: 'port',
  processor: (value) => {
    const num = Number(value);
    if (!(Number.isInteger(num) && num >= 1 && num <= 65535)) {
      throw new ConstraintError('Port must be between 1 and 65535');
    }
    return num;
  }
};
