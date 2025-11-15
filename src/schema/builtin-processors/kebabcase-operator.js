import { toKebabCase } from '../../utils.js';

/**
 * Convert string to kebab-case
 */
export const KEBABCASE_OPERATOR = {
  process: (value) => {
    return toKebabCase(String(value));
  }
};
