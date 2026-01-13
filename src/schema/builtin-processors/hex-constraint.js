import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$hex`
 *
 * Validates that a string contains only valid hexadecimal characters (0-9, a-f, A-F).
 * Does not require or validate a "0x" prefix - the value should be the raw hex digits.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$hex')
 *
 * // Validate a color hex code
 * Schema.create('object', {
 *   color: Schema.create('string').validator('$hex')
 * })
 *
 * // Validate a hash or token
 * Schema.create('object', {
 *   apiToken: Schema.create('string').validator('$hex')
 * })
 * ```
 *
 * **Valid values**: `"ff00aa"`, `"DEADBEEF"`, `"123abc"`, `"0"`, `"ABC123def456"`
 *
 * **Invalid values**: `"0x123"` (prefix not allowed), `"hello"` (non-hex chars), `"gg"` (invalid char), `""` (empty string)
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const HEX_CONSTRAINT = {
  keyword: 'hex',
  processor: (value) => {
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(value)) {
      throw new ConstraintError('Must contain only hexadecimal characters');
    }
    return value;
  }
};
