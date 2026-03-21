import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$base64-decode`
 *
 * Decodes a Base64-encoded string to a Buffer.
 * Throws if the input is not a string.
 *
 * **Input**: `"SGVsbG8="` → **Output**: `Buffer<48 65 6c 6c 6f>`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const BASE64_DECODE_OPERATOR = {
  keyword: 'base64-decode',
  process: (value, _target, location) => {
    if (typeof value !== 'string') {
      throw new ConstraintError(`$base64-decode requires a string, got ${formatValue(value)}`, {location});
    }
    return Buffer.from(value, 'base64');
  }
};
