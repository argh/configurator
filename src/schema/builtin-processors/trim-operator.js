/**
 * ## $trim
 *
 * Removes leading and trailing whitespace from a string value.
 * Safe to use in normalize phase (non-throwing operator).
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const TRIM_OPERATOR = {
  keyword: 'trim',
  process: (value) => {
    return String(value).trim();
  }
};
