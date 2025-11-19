/**
 * Trim whitespace from both ends of string
 */
export const TRIM_OPERATOR = {
  keyword: 'trim',
  processor: (value) => {
    return String(value).trim();
  }
};
