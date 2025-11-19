import { ConstraintError } from '../../errors.js';

/**
 * Validate IPv4 address
 */
export const IPV4_CONSTRAINT = {
  keyword: 'ipv4',
  processor: (value) => {
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipv4Regex.test(value)) {
      throw new ConstraintError('Invalid IPv4 address');
    }
    return value;
  }
};
