import { ConstraintError } from '../schema-errors.js';

/**
 * ## $port
 *
 * Validates that a value is a valid TCP/UDP port number (1-65535).
 * Accepts numeric values or strings that can be converted to numbers.
 * Returns the value as a number or a string, depending on the underlying schema.
 * (defaults to a number).
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
