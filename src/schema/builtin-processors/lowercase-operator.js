/**
 * **Processor**: `$lowercase`
 *
 * Converts a string value to lowercase.
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$lowercase')
 *
 * // Combined with other processors in a pipeline
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$lowercase')
 *
 * // In a schema property
 * Schema.create('object', {
 *   username: Schema.create('string').normalizer('$lowercase')
 * })
 * ```
 *
 * **Input**: `"Hello WORLD"` → **Output**: `"hello world"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const LOWERCASE_OPERATOR = {
  keyword: 'lowercase',
  processor: (value) => {
    return String(value).toLowerCase();
  }
};
