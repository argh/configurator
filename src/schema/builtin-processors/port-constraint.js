import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$port`
 *
 * Validates that a value is a valid TCP/UDP port number (1-65535).
 * Accepts numeric values or strings that can be converted to numbers.
 * Returns the value as a number or a string, depending on the underlying schema.
 * (defaults to a number).
 *
 * **Valid values**: `80`, `443`, `8080`, `3000`, `"8080"` (string), `65535`
 *
 * **Invalid values**: `0`, `-1`, `65536`, `100000`, `3.14`, `"abc"`, `null`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const PORT_CONSTRAINT = {
  keyword: 'port',
  process: (value, _target, location) => {
    const num = Number(value);
    if (!(Number.isInteger(num) && num >= 1 && num <= 65535)) {
      throw new ConstraintError('Port must be between 1 and 65535');
    }
    return location.schema.options.type === 'string'? `${num}` : num;
  }
};
