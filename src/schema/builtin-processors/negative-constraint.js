import { ConstraintError } from '../../errors.js';

/**
 * Validate negative number
 */
export const NEGATIVE_CONSTRAINT = {
  keyword: 'negative',
  processor: (value) => {
    const num = Number(value);
    if (!(Number.isFinite(num) && num < 0)) {
      throw new ConstraintError('Must be a negative number');
    }
    return num;
  }
};
