import { ConstraintError } from '../schema-errors.js';

/**
 * ## $url
 *
 * Validates that a string is a valid URL and normalizes it to canonical form.
 * Uses the WHATWG URL Standard for validation and normalization. The normalized
 * URL includes explicit protocol, properly encoded characters, and standardized formatting.
 *
 * - `https://example.com` → `https://example.com/`
 * - `http://localhost:8080/api` → `http://localhost:8080/api`
 * - `https://example.com/path?query=value` → `https://example.com/path?query=value`
 * - `ftp://files.example.com/` → `ftp://files.example.com/`
 *
 * - `not-a-url` (missing protocol)
 * - `//example.com` (missing protocol)
 * - `example.com` (missing protocol)
 * - `http://` (missing host)
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const URL_CONSTRAINT = {
  keyword: 'url',
  process: (value) => {
    try {
      return new URL(value).toString();
    } catch {
      throw new ConstraintError('Invalid URL format');
    }
  }
};
