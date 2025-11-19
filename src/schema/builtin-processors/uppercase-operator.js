/**
 * Convert string to uppercase
 */
export const UPPERCASE_OPERATOR = {
  keyword: 'uppercase',
  processor: (value) => {
    return String(value).toUpperCase();
  }
};
