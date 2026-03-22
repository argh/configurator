import { ConstraintError } from '../schema-errors.js';

/**
 * ## $hex
 *
 * Validates that a string contains only valid hexadecimal characters (0-9, a-f, A-F).
 * Does not require or validate a "0x" prefix - the value should be the raw hex digits.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const HEX_CONSTRAINT = {
  keyword: 'hex',
  process: (value) => {
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(value)) {
      throw new ConstraintError('Must contain only hexadecimal characters');
    }
    return value;
  }
};
