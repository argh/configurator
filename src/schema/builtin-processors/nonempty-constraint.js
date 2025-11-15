import { ConstraintError } from '../../errors.js';

/**
 * Validate non-empty value
 */
export const NONEMPTY_CONSTRAINT = {
  process: (value) => {
    if (!(value && value.toString().trim().length > 0)) {
      throw new ConstraintError('Value cannot be empty');
    }
    return value;
  }
};
