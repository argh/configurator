import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$alphanum`
 *
 * Validates that a string contains only alphanumeric characters (A-Z, a-z, 0-9).
 * No spaces, punctuation, or special characters are allowed.
 *
 * **Valid values**: `abc123`, `UserName123`, `ABC`, `12345`
 *
 * **Invalid values**: `user-name`, `user_name`, `user name`, `user@name`, `user.name`, `` (empty string)
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const ALPHANUM_CONSTRAINT = {
  keyword: 'alphanum',
  process: (value) => {
    const alphanumRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumRegex.test(value)) {
      throw new ConstraintError('Must contain only alphanumeric characters');
    }
    return value;
  }
};
