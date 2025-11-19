import { ConstraintError } from '../../errors.js';

/**
 * Validate positive number
 */
export const POSITIVE_CONSTRAINT = {
  keyword: 'positive',
  processor: (value) => {
    const num = Number(value);
    if (!(Number.isFinite(num) && num > 0)) {
      throw new ConstraintError('Must be a positive number');
    }
    return num;
  }
};
