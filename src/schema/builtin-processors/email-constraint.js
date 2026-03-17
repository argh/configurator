import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$email`
 *
 * Validates that a string matches basic email address format (local-part@domain.tld).
 * Checks for the presence of `@` symbol with valid characters before and after, and
 * requires a domain with at least one dot.
 *
 * @example
 * **Valid values**: `user@example.com`, `john.doe@company.co.uk`, `admin@localhost.localdomain`
 *
 * **Invalid values**: `invalid`, `@example.com`, `user@`, `user @example.com`, `user@domain`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const EMAIL_CONSTRAINT = {
  keyword: 'email',
  process: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ConstraintError('Invalid email format');
    }
    return value;
  }
};
