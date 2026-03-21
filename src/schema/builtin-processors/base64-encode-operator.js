import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$base64-encode`
 *
 * Encodes a Buffer to a Base64 string.
 * Throws if the input is not a Buffer.
 *
 * **Input**: `Buffer<48 65 6c 6c 6f>` → **Output**: `"SGVsbG8="`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const BASE64_ENCODE_OPERATOR = {
  keyword: 'base64-encode',
  process: (value, _target, location) => {
    if (!Buffer.isBuffer(value)) {
      throw new ConstraintError(`$base64-encode requires a Buffer, got ${formatValue(value)}`, {location});
    }
    return value.toString('base64');
  }
};
