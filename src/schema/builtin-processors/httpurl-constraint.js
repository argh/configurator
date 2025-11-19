import { ConstraintError } from '../../errors.js';

/**
 * Validate HTTP/HTTPS URL format
 */
export const HTTPURL_CONSTRAINT = {
  keyword: 'httpurl',
  processor: async (value) => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new ConstraintError('URL must use HTTP or HTTPS protocol');
      }
      return value;
    } catch (error) {
      if (error instanceof ConstraintError) {
        throw error;
      }
      throw new ConstraintError('Invalid HTTP URL format', {cause: error});
    }
  }
};
