import { ConstraintError } from '../../errors.js';

/**
 * Validate and normalize URL
 */
export const URL_CONSTRAINT = {
  process: (value) => {
    try {
      return new URL(value).toString();
    } catch {
      throw new ConstraintError('Invalid URL format');
    }
  }
};
