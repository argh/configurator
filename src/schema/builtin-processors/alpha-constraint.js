import { ConstraintError } from '../schema-errors.js';

/**
 * ## $alpha
 *
 * Validates that a string contains only alphabetic characters (a-z, A-Z).
 * No spaces, numbers, punctuation, or special characters are allowed.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const ALPHA_CONSTRAINT = {
  keyword: 'alpha',
  process: (value) => {
    const alphaRegex = /^[a-zA-Z]+$/;
    if (!alphaRegex.test(value)) {
      throw new ConstraintError('Must contain only letters');
    }
    return value;
  }
};
