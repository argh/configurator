/**
 * Convert string to lowercase
 */
export const LOWERCASE_OPERATOR = {
  keyword: 'lowercase',
  processor: (value) => {
    return String(value).toLowerCase();
  }
};
