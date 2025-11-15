import { ConstraintError } from '../../errors.js';

/**
 * Validate and convert to integer
 */
export const INTEGER_CONSTRAINT = {
  process: (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number');
    }
    if (num !== Math.floor(num)) {
      throw new ConstraintError('Must be an integer');
    }
    return num;
  }
};
