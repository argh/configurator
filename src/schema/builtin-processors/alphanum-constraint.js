import { ConstraintError } from '../../errors.js';

/**
 * Validate alphanumeric characters only
 */
export const ALPHANUM_CONSTRAINT = {
  process: (value) => {
    const alphanumRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumRegex.test(value)) {
      throw new ConstraintError('Must contain only alphanumeric characters');
    }
    return value;
  }
};
