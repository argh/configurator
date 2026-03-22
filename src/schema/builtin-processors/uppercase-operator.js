/**
 * ## $uppercase
 *
 * Converts a string value to uppercase. Safe to use in normalize phase (non-throwing).
 * Non-string values are coerced to strings before conversion.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const UPPERCASE_OPERATOR = {
  keyword: 'uppercase',
  process: (value) => {
    return String(value).toUpperCase();
  }
};
