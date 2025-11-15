import { toPascalCase } from '../../utils.js';

/**
 * Convert string to PascalCase
 */
export const PASCALCASE_OPERATOR = {
  process: (value) => {
    return toPascalCase(String(value));
  }
};
