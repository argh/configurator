import { toCamelCase } from '../../utils.js';

/**
 * Convert string to camelCase
 */
export const CAMELCASE_OPERATOR = {
  keyword: 'camelcase',
  processor: (value) => {
    return toCamelCase(String(value));
  }
};
