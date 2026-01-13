import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$ipv4`
 *
 * Validates that a string matches valid IPv4 address format (dotted-decimal notation).
 * Each octet must be between 0 and 255.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$ipv4')
 *
 * // In a schema property
 * Schema.create('object', {
 *   serverIp: Schema.create('string').validator('$ipv4'),
 *   gatewayIp: Schema.create('string').validator('$ipv4')
 * })
 * ```
 *
 * **Valid values**: `192.168.1.1`, `10.0.0.1`, `127.0.0.1`, `255.255.255.255`, `0.0.0.0`
 *
 * **Invalid values**: `256.1.1.1`, `192.168.1`, `192.168.1.1.1`, `192.168.-1.1`, `abc.def.ghi.jkl`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const IPV4_CONSTRAINT = {
  keyword: 'ipv4',
  processor: (value) => {
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipv4Regex.test(value)) {
      throw new ConstraintError('Invalid IPv4 address');
    }
    return value;
  }
};
