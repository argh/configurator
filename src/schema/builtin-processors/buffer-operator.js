import { ConstraintError } from '../schema-errors.js';

/**
 * ## $buffer
 *
 * Converts a value to a Node.js Buffer.  Accepts:
 * - `Buffer` — passed through unchanged
 * - `string` — decoded from Base64 via `Buffer.from(value, 'base64')`
 * - `{size, fill?, encoding?}` — allocated via `Buffer.alloc(size, fill, encoding)`
 * - `{encoding, buffer}` — constructed from an underlying ArrayBuffer via `Buffer.from(value.buffer)`
 * - anything else (TypedArray, byte array, etc.) — via `Buffer.from(value)`
 *
 * See `$is-buffer` for strict Buffer validation without conversion.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const BUFFER_OPERATOR = {
  keyword: 'buffer',
  process: (value) => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    try {
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }
      if (typeof value === 'object' && Number.isInteger(value?.size)) {
        return Buffer.alloc(value.size, value.fill ?? 0, value.encoding ?? 'utf8');
      }
      if (typeof value === 'object' && value?.encoding !== undefined) {
        return Buffer.from(value.buffer);
      }
      return Buffer.from(value);
    }
    catch (error) {
      throw new ConstraintError('Buffer array contains invalid data', {cause: error});
    }
  }
};
