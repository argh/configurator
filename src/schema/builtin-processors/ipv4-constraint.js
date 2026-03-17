import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$ipv4`
 *
 * Validates that a string matches valid IPv4 address format (dotted-decimal notation).
 * Each octet must be between 0 and 255.
 *
 * **Valid values**: `192.168.1.1`, `10.0.0.1`, `127.0.0.1`, `255.255.255.255`, `0.0.0.0`
 *
 * **Invalid values**: `256.1.1.1`, `192.168.1`, `192.168.1.1.1`, `192.168.-1.1`, `abc.def.ghi.jkl`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IPV4_CONSTRAINT = {
  keyword: 'ipv4',
  process: (value) => {
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipv4Regex.test(value)) {
      throw new ConstraintError('Invalid IPv4 address');
    }
    return value;
  }
};
