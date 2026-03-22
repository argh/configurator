import { ConstraintError } from '../schema-errors.js';

/**
 * ## $alphanum
 *
 * Validates that a string contains only alphanumeric characters (A-Z, a-z, 0-9).
 * No spaces, punctuation, or special characters are allowed.
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
