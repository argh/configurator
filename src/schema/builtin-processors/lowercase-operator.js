/**
 * ## $lowercase
 *
 * Converts a string value to lowercase.
 * Safe to use in normalize phase (non-throwing).
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const LOWERCASE_OPERATOR = {
  keyword: 'lowercase',
  process: (value) => {
    return String(value).toLowerCase();
  }
};
