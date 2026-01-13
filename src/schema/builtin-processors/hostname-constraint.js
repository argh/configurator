import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$hostname`
 *
 * Validates that a string matches valid hostname format according to RFC 1123.
 * Hostnames must start and end with alphanumeric characters and may contain
 * hyphens between labels. Each label (section between dots) can be up to 63
 * characters long.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$hostname')
 *
 * // In a schema property
 * Schema.create('object', {
 *   serverHost: Schema.create('string').validator('$hostname'),
 *   apiEndpoint: Schema.create('string').validator('$hostname')
 * })
 * ```
 *
 * **Valid values**: `example.com`, `sub.example.com`, `localhost`, `api-server.example.com`, `host123.domain.org`
 *
 * **Invalid values**: `-invalid.com`, `example..com`, `example.com-`, `under_score.com`, `example-.com`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const HOSTNAME_CONSTRAINT = {
  keyword: 'hostname',
  processor: (value) => {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!hostnameRegex.test(value)) {
      throw new ConstraintError('Invalid hostname format');
    }
    return value;
  }
};
