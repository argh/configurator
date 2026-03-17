import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$base64`
 *
 * Validates that a string is properly formatted Base64 encoded data.
 * Checks for valid Base64 character set (A-Z, a-z, 0-9, +, /) and proper
 * padding with equals signs. If padding is present, the total length must
 * be a multiple of 4.
 *
 * **Valid values**: `SGVsbG8gV29ybGQ=`, `YWJjMTIz`, `dGVzdA==`, `QUJDREVGR0hJSg==`
 *
 * **Invalid values**: `Hello World!` (not encoded), `SGVsbG8=` (invalid padding), `SGVs#bG8=` (invalid character)
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const BASE64_CONSTRAINT = {
  keyword: 'base64',
  process: (value) => {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(value)) {
      throw new ConstraintError('Invalid base64 format');
    }
    // If there's padding, length must be multiple of 4
    if (value.includes('=') && value.length % 4 !== 0) {
      throw new ConstraintError('Invalid base64 format');
    }
    return value;
  }
};
