import { ConstraintError } from '../../errors.js';

/**
 * Validate base64 format
 */
export const BASE64_CONSTRAINT = {
  keyword: 'base64',
  processor: (value) => {
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
