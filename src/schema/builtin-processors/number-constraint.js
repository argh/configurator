import { ConstraintError } from '../../errors.js';

/**
 * Validate and convert to number
 */
export const NUMBER_CONSTRAINT = {
  process: (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new ConstraintError('Must be a number');
    }
    return num;
  }
};
