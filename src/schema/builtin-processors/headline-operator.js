import { toHeadline } from '../../utils.js';

/**
 * **Processor**: `$headline`
 *
 * Converts a string value to Headline Case/Title Case format (first letter of each word capitalized, separated by spaces).
 * Safe to use in normalize phase (non-throwing).
 *
 * **Input**: `"hello world"` → **Output**: `"Hello World"`
 *
 * **Input**: `"user-profile-page"` → **Output**: `"User Profile Page"`
 *
 * **Input**: `"api_response_handler"` → **Output**: `"Api Response Handler"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const HEADLINE_OPERATOR = {
  keyword: 'headline',
  process: (value) => {
    return toHeadline(String(value));
  }
};
