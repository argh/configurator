import { ConstraintError } from '../../errors.js';

/**
 * Validate JSON format
 */
export const JSON_CONSTRAINT = {
  keyword: 'json',
  processor: (value) => {
    try {
      JSON.parse(value);
      return value;
    } catch {
      throw new ConstraintError('Invalid JSON format');
    }
  }
};
