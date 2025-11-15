import { ConstraintError } from '../../errors.js';

/**
 * Validate hostname format
 */
export const HOSTNAME_CONSTRAINT = {
  process: (value) => {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!hostnameRegex.test(value)) {
      throw new ConstraintError('Invalid hostname format');
    }
    return value;
  }
};
