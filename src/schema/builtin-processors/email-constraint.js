import { ConstraintError } from '../../errors.js';

/**
 * Validate email format
 */
export const EMAIL_CONSTRAINT = {
  keyword: 'email',
  processor: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ConstraintError('Invalid email format');
    }
    return value;
  }
};
