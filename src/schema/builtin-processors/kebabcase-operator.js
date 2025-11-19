import { toKebabCase } from '../../utils.js';

/**
 * Convert string to kebab-case
 */
export const KEBABCASE_OPERATOR = {
  keyword: 'kebabcase',
  processor: (value) => {
    return toKebabCase(String(value));
  }
};
