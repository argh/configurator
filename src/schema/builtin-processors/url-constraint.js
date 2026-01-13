import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$url`
 *
 * Validates that a string is a valid URL and normalizes it to canonical form.
 * Uses the WHATWG URL Standard for validation and normalization. The normalized
 * URL includes explicit protocol, properly encoded characters, and standardized formatting.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$url')
 *
 * // In a schema property
 * Schema.create('object', {
 *   apiEndpoint: Schema.create('string').validator('$url'),
 *   websiteUrl: Schema.create('string').validator('$url')
 * })
 *
 * // Use as normalizer to canonicalize URLs early in the pipeline
 * Schema.create('string')
 *   .normalizer('$url')
 *   .transformer((url) => new URL(url)) // Convert to URL object
 * ```
 *
 * **Valid values**:
 * - `https://example.com` → `https://example.com/`
 * - `http://localhost:8080/api` → `http://localhost:8080/api`
 * - `https://example.com/path?query=value` → `https://example.com/path?query=value`
 * - `ftp://files.example.com/` → `ftp://files.example.com/`
 *
 * **Invalid values**:
 * - `not-a-url` (missing protocol)
 * - `//example.com` (missing protocol)
 * - `example.com` (missing protocol)
 * - `http://` (missing host)
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const URL_CONSTRAINT = {
  keyword: 'url',
  processor: (value) => {
    try {
      return new URL(value).toString();
    } catch {
      throw new ConstraintError('Invalid URL format');
    }
  }
};
