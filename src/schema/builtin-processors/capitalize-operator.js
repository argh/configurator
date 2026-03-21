import { toCapitalize } from '../../utils.js';

/**
 * **Processor**: `$capitalize`
 *
 * Capitalizes the first letter of each word, separated by spaces. Words are split on
 * non-alphanumeric boundaries (spaces, hyphens, underscores, camelCase transitions, etc.).
 * Every word is capitalized unconditionally — see `$title-case` for proper title case
 * that respects articles and conjunctions.
 *
 * **Input**: `"hello world"` → **Output**: `"Hello World"`
 *
 * **Input**: `"user-profile-page"` → **Output**: `"User Profile Page"`
 *
 * **Input**: `"sisters-of-mercy"` → **Output**: `"Sisters Of Mercy"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const CAPITALIZE_OPERATOR = {
  keyword: 'capitalize',
  process: (value) => toCapitalize(String(value))
};
