import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$http-url`
 *
 * Validates that a string is a valid HTTP or HTTPS URL. Uses the URL Web API for
 * validation and specifically requires the protocol to be either `http:` or `https:`.
 *
 * **Valid values**: `https://example.com`, `http://localhost:3000/api`, `https://api.example.com/v1/users?page=1`
 *
 * **Invalid values**: `ftp://example.com` (wrong protocol), `example.com` (missing protocol), `http://` (missing host), `not a url`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const HTTP_URL_CONSTRAINT = {
  keyword: 'http-url',
  process: (value) => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new ConstraintError('URL must use HTTP or HTTPS protocol');
      }
      return value;
    } catch (error) {
      if (error instanceof ConstraintError) {
        throw error;
      }
      throw new ConstraintError('Invalid HTTP URL format', {cause: error});
    }
  }
};
