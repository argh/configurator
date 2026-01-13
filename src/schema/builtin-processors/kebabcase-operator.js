import { toKebabCase } from '../../utils.js';

/**
 * **Processor**: `$kebabcase`
 *
 * Converts a string to kebab-case format (lowercase words separated by hyphens).
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$kebabcase')
 *
 * // Convert API keys or identifiers
 * Schema.create('object', {
 *   apiKey: Schema.create('string').normalizer('$kebabcase')
 * })
 *
 * // Combined with other processors
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$kebabcase')
 * ```
 *
 * **Input/Output Examples**:
 * - `"HelloWorld"` → `"hello-world"`
 * - `"API_KEY_NAME"` → `"api-key-name"`
 * - `"some text here"` → `"some-text-here"`
 * - `"camelCase"` → `"camel-case"`
 * - `"already-kebab"` → `"already-kebab"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const KEBABCASE_OPERATOR = {
  keyword: 'kebabcase',
  processor: (value) => {
    return toKebabCase(String(value));
  }
};
