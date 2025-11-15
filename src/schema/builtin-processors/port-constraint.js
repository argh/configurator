import { ConstraintError } from '../../errors.js';

/**
 * Validate port number
 */
export const PORT_CONSTRAINT = {
  process: (value) => {
    const num = Number(value);
    if (!(Number.isInteger(num) && num >= 1 && num <= 65535)) {
      throw new ConstraintError('Port must be between 1 and 65535');
    }
    return num;
  }
};
