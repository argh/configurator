/**
 * **Processor**: `$trim`
 *
 * Removes leading and trailing whitespace from a string value.
 * Safe to use in normalize phase (non-throwing operator).
 *
 * @example
 * ```javascript
 * // Basic usage in normalizer
 * Schema.create('string').normalizer('$trim')
 *
 * // Combined with other processors
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$lowercase')
 *
 * // In an object schema
 * Schema.create('object', {
 *   username: Schema.create('string').normalizer('$trim'),
 *   email: Schema.create('string').normalizer('$trim').normalizer('$lowercase')
 * })
 * ```
 *
 * **Input**: `"  hello world  "` → **Output**: `"hello world"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const TRIM_OPERATOR = {
  keyword: 'trim',
  processor: (value) => {
    return String(value).trim();
  }
};
