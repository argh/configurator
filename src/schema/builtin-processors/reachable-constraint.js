import { lookup } from 'node:dns/promises';
import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$reachable` (async)
 *
 * Validates that a hostname is reachable by performing a DNS lookup.
 * This is an asynchronous processor that checks if the hostname resolves to an IP address.
 *
 * Note: This processor performs a network operation and may fail if DNS is unavailable
 * or the hostname does not exist. It does not verify that the host is responding on any port,
 * only that it has a DNS record.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$reachable')
 *
 * // Combined with hostname validation
 * Schema.create('string')
 *   .validator('$hostname')
 *   .validator('$reachable')
 *
 * // In a schema property
 * Schema.create('object', {
 *   apiHost: Schema.create('string').validator('$reachable'),
 *   databaseHost: Schema.create('string').validator('$reachable')
 * })
 * ```
 *
 * **Valid values**: `google.com`, `localhost`, `example.com`, `192.0.2.1`
 *
 * **Invalid values**: `nonexistent-host-12345.example`, `invalid..hostname`, hostnames that cannot be resolved via DNS
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const REACHABLE_CONSTRAINT = {
  keyword: 'reachable',
  processor: async (value) => {
    try {
      await lookup(value);
      return value;
    } catch {
      throw new ConstraintError('Host is not reachable');
    }
  }
};
