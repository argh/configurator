import { toHeadline } from '../../utils.js';

/**
 * **Processor**: `$headline`
 *
 * Converts a string value to Headline Case/Title Case format (first letter of each word capitalized, separated by spaces).
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$headline')
 *
 * // Convert titles to proper headline case
 * Schema.create('object', {
 *   pageTitle: Schema.create('string').normalizer('$headline'),
 *   sectionHeading: Schema.create('string').normalizer('$headline')
 * })
 *
 * // Combined with other processors in a pipeline
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$headline')
 * ```
 *
 * **Input**: `"hello world"` → **Output**: `"Hello World"`
 *
 * **Input**: `"user-profile-page"` → **Output**: `"User Profile Page"`
 *
 * **Input**: `"api_response_handler"` → **Output**: `"Api Response Handler"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const HEADLINE_OPERATOR = {
  keyword: 'headline',
  processor: (value) => {
    return toHeadline(String(value));
  }
};
