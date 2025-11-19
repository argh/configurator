import { ConstraintError } from '../../errors.js';

/**
 * Validate UUID format
 */
export const UUID_CONSTRAINT = {
  keyword: 'uuid',
  processor: (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ConstraintError('Invalid UUID format');
    }
    return value;
  }
};
