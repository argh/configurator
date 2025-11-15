import { toHeadline } from '../../utils.js';

/**
 * Convert string to Headline Case
 */
export const HEADLINE_OPERATOR = {
  process: (value) => {
    return toHeadline(String(value));
  }
};
