import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$alpha`
 *
 * Validates that a string contains only alphabetic characters (a-z, A-Z).
 * No spaces, numbers, punctuation, or special characters are allowed.
 *
 * **Valid values**: `hello`, `ABC`, `MyVariable`, `en`, `USA`
 *
 * **Invalid values**: `hello123`, `hello world`, `hello-world`, `hello_world`, `hello!`, `123`, ``
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
