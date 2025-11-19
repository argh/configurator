import { toHeadline } from '../../utils.js';

/**
 * Convert string to Headline Case
 */
export const HEADLINE_OPERATOR = {
  keyword: 'headline',
  processor: (value) => {
    return toHeadline(String(value));
  }
};
