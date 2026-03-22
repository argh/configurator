import { ConstraintError } from '../schema-errors.js';

/**
 * ## $hostname
 *
 * Validates that a string matches valid hostname format according to RFC 1123.
 * Hostnames must start and end with alphanumeric characters and may contain
 * hyphens between labels. Each label (section between dots) can be up to 63
 * characters long.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const HOSTNAME_CONSTRAINT = {
  keyword: 'hostname',
  process: (value) => {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!hostnameRegex.test(value)) {
      throw new ConstraintError('Invalid hostname format');
    }
    return value;
  }
};
