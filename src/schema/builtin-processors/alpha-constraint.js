import { ConstraintError } from '../../errors.js';

/**
 * Validate alphabetic characters only
 */
export const ALPHA_CONSTRAINT = {
  process: (value) => {
    const alphaRegex = /^[a-zA-Z]+$/;
    if (!alphaRegex.test(value)) {
      throw new ConstraintError('Must contain only letters');
    }
    return value;
  }
};
