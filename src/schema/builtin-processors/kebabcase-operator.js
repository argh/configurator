import { toKebabCase } from '../../utils.js';

/**
 * **Processor**: `$kebabcase`
 *
 * Converts a string to kebab-case format (lowercase words separated by hyphens).
 * Safe to use in normalize phase (non-throwing).
 *
 * **Input/Output Examples**:
 * - `"HelloWorld"` → `"hello-world"`
 * - `"API_KEY_NAME"` → `"api-key-name"`
 * - `"some text here"` → `"some-text-here"`
 * - `"camelCase"` → `"camel-case"`
 * - `"already-kebab"` → `"already-kebab"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const KEBABCASE_OPERATOR = {
  keyword: 'kebabcase',
  process: (value) => {
    return toKebabCase(String(value));
  }
};
