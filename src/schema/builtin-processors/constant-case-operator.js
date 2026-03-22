import { toConstantCase } from '../../utils.js';

/**
 * ## $constant-case
 *
 * Converts a string to CONSTANT_CASE format (uppercase letters with underscores).
 * Safe to use in normalize phase (non-throwing).
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const CONSTANT_CASE_OPERATOR = {
  keyword: 'constant-case',
  process: (value) => {
    return toConstantCase(String(value));
  }
};
