import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$ipv6`
 *
 * Validates that a string is a properly formatted IPv6 address. Supports all standard IPv6
 * notation formats including full notation, compressed notation (::), link-local addresses,
 * IPv4-mapped IPv6 addresses, and zone identifiers.
 *
 * **Valid values**:
 * - Full notation: `2001:0db8:0000:0000:0000:0000:0000:0001`
 * - Compressed: `2001:db8::1`
 * - Loopback: `::1`
 * - All zeros: `::`
 * - Link-local: `fe80::1%eth0`
 * - IPv4-mapped: `::ffff:192.0.2.1`
 *
 * **Invalid values**: `192.168.1.1` (IPv4), `gggg::1` (invalid hex), `2001:db8::1::2` (double compression), `not-an-ip`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IPV6_CONSTRAINT = {
  keyword: 'ipv6',
  process: (value) => {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    if (!ipv6Regex.test(value)) {
      throw new ConstraintError('Invalid IPv6 address');
    }
    return value;
  }
};
