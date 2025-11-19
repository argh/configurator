import { ConstraintError } from '../../errors.js';

/**
 * Validate hexadecimal format
 */
export const HEX_CONSTRAINT = {
  keyword: 'hex',
  processor: (value) => {
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(value)) {
      throw new ConstraintError('Must contain only hexadecimal characters');
    }
    return value;
  }
};
