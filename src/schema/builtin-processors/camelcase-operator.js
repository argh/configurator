import { toCamelCase } from '../../utils.js';

/**
 * Convert string to camelCase
 */
export const CAMELCASE_OPERATOR = {
  process: (value) => {
    return toCamelCase(String(value));
  }
};
