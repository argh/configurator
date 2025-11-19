import { toConstantCase } from '../../utils.js';

/**
 * Convert string to CONSTANT_CASE
 */
export const CONSTANTCASE_OPERATOR = {
  keyword: 'constantcase',
  processor: (value) => {
    return toConstantCase(String(value));
  }
};
