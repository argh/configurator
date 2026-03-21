import { toTitleCase } from '../../utils.js';

/**
 * **Processor**: `$title-case`
 *
 * Converts a string to title case, capitalizing the first letter of each significant word
 * and leaving articles, coordinating conjunctions, and short prepositions lowercase when
 * they appear in the middle of the phrase. The first and last words are always capitalized.
 *
 * Lowercase words: a, an, the, and, but, or, nor, for, so, yet, at, by, in, of, on, to, up, as, via
 *
 * **Input**: `"sisters-of-mercy"` → **Output**: `"Sisters of Mercy"`
 *
 * **Input**: `"the lord of the rings"` → **Output**: `"The Lord of the Rings"`
 *
 * **Input**: `"war and peace"` → **Output**: `"War and Peace"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const TITLE_CASE_OPERATOR = {
  keyword: 'title-case',
  process: (value) => toTitleCase(String(value))
};
