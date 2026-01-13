import { toCamelCase } from '../../utils.js';

/**
 * **Processor**: `$camelcase`
 *
 * Converts a string value to camelCase format. Words are identified by spaces,
 * hyphens, underscores, or case changes. The first letter is lowercased, and
 * subsequent words are capitalized with no separators.
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$camelcase')
 *
 * // Combined with trim in a pipeline
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$camelcase')
 *
 * // In a configuration schema
 * Schema.create('object', {
 *   apiMethod: Schema.create('string').normalizer('$camelcase')
 * })
 * ```
 *
 * **Input examples**:
 * - `"hello world"` → **Output**: `"helloWorld"`
 * - `"foo-bar-baz"` → **Output**: `"fooBarBaz"`
 * - `"user_name_id"` → **Output**: `"userNameId"`
 * - `"HTTPSConnection"` → **Output**: `"httpsConnection"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const CAMELCASE_OPERATOR = {
  keyword: 'camelcase',
  processor: (value) => {
    return toCamelCase(String(value));
  }
};
