import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$alpha`
 *
 * Validates that a string contains only alphabetic characters (a-z, A-Z).
 * No spaces, numbers, punctuation, or special characters are allowed.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$alpha')
 *
 * // Username validation example
 * Schema.create('object', {
 *   username: Schema.create('string').validator('$alpha')
 * })
 *
 * // Language code validation
 * Schema.create('object', {
 *   languageCode: Schema.create('string')
 *     .validator('$alpha')
 *     .validator({$length: {min: 2, max: 3}})
 * })
 * ```
 *
 * **Valid values**: `hello`, `ABC`, `MyVariable`, `en`, `USA`
 *
 * **Invalid values**: `hello123`, `hello world`, `hello-world`, `hello_world`, `hello!`, `123`, ``
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const ALPHA_CONSTRAINT = {
  keyword: 'alpha',
  processor: (value) => {
    const alphaRegex = /^[a-zA-Z]+$/;
    if (!alphaRegex.test(value)) {
      throw new ConstraintError('Must contain only letters');
    }
    return value;
  }
};
