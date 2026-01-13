/**
 * **Processor**: `$uppercase`
 *
 * Converts a string value to uppercase. Safe to use in normalize phase (non-throwing).
 * Non-string values are coerced to strings before conversion.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$uppercase')
 *
 * // Combined with other processors
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$uppercase')
 *
 * // In a schema property
 * Schema.create('object', {
 *   countryCode: Schema.create('string').normalizer('$uppercase')
 * })
 * ```
 *
 * **Input**: `"hello world"` → **Output**: `"HELLO WORLD"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const UPPERCASE_OPERATOR = {
  keyword: 'uppercase',
  processor: (value) => {
    return String(value).toUpperCase();
  }
};
