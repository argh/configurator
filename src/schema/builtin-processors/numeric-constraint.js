import { ConstraintError } from '../../errors.js';

/**
 * Validate numeric digits only
 */
export const NUMERIC_CONSTRAINT = {
  process: (value) => {
    const v = `${value}`;
    const numericRegex = /^[0-9]+$/;
    if (!numericRegex.test(v)) {
      throw new ConstraintError('Must contain only digits');
    }
    return value;
  }
};
