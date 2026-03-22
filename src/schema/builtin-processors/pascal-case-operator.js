import { toPascalCase } from '../../utils.js';

/**
 * ## $pascal-case
 *
 * Converts a string value to PascalCase format (first letter of each word capitalized, no separators).
 * Safe to use in normalize phase (non-throwing).
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const PASCAL_CASE_OPERATOR = {
  keyword: 'pascal-case',
  process: (value) => {
    return toPascalCase(String(value));
  }
};
