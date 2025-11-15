/**
 * Trim whitespace from both ends of string
 */
export const TRIM_OPERATOR = {
  process: (value) => {
    return String(value).trim();
  }
};
