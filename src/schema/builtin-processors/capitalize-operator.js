import { toCapitalize } from '../../utils.js';

/**
 * ## $capitalize
 *
 * Capitalizes the first letter of each word, separated by spaces. Words are split on
 * non-alphanumeric boundaries (spaces, hyphens, underscores, camelCase transitions, etc.).
 * Every word is capitalized unconditionally — see `$title-case` for proper title casing
 * that respects articles and conjunctions.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const CAPITALIZE_OPERATOR = {
  keyword: 'capitalize',
  process: (value) => toCapitalize(String(value))
};
