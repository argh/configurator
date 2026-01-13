import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$alphanum`
 *
 * Validates that a string contains only alphanumeric characters (A-Z, a-z, 0-9).
 * No spaces, punctuation, or special characters are allowed.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$alphanum')
 *
 * // Username validation
 * Schema.create('object', {
 *   username: Schema.create('string').validator('$alphanum')
 * })
 *
 * // API key validation
 * Schema.create('object', {
 *   apiKey: Schema.create('string')
 *     .validator('$alphanum')
 *     .validator({$length: {min: 32, max: 32}})
 * })
 * ```
 *
 * **Valid values**: `abc123`, `UserName123`, `ABC`, `12345`
 *
 * **Invalid values**: `user-name`, `user_name`, `user name`, `user@name`, `user.name`, `` (empty string)
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const ALPHANUM_CONSTRAINT = {
  keyword: 'alphanum',
  processor: (value) => {
    const alphanumRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumRegex.test(value)) {
      throw new ConstraintError('Must contain only alphanumeric characters');
    }
    return value;
  }
};
