import * as fs from 'node:fs/promises';
import { ConstraintError, ResolverError } from '../schema-errors.js';

/**
 * **Processor**: `$file-size` (async, parameterized)
 *
 * Validates that a file's size falls within the specified range. Accepts size constraints
 * in bytes and checks the file's metadata without loading the entire file into memory.
 * Can specify minimum, maximum, or both bounds.
 *
 * **This is an async processor** that performs filesystem I/O and must be used in the
 * validation phase (not normalization phase).
 *
 * **Parameters**:
 * - `min` (number, optional): Minimum file size in bytes (inclusive). If omitted, no lower bound.
 * - `max` (number, optional): Maximum file size in bytes (inclusive). If omitted, no upper bound.
 *
 * **Unit Conversions**: Size must be specified in bytes. Use standard conversions:
 * - 1 KB = 1024 bytes
 * - 1 MB = 1024 * 1024 bytes (1,048,576)
 * - 1 GB = 1024 * 1024 * 1024 bytes (1,073,741,824)
 *
 * **Valid values**: Any file path string where the file exists and its size satisfies the constraints
 *
 * **Invalid values**: Non-existent files, files smaller than `min`, files larger than `max`
 *
 * **Note**: Typically used with `$file` validator to ensure the file exists before checking size.
 * The processor reads file metadata via `fs.stat()` and does not load file contents.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const FILE_SIZE_CONSTRAINT = {
  keyword: 'file-size',
  parameters: [ { parameter: 'min' }, { parameter: 'max' } ],

  process: async (value, _target, _location, options) => {

    const min = options.args.min;
    const max = options.args.max;

    try {
      const stat = await fs.stat(value);
      const size = stat.size;

      if (min !== undefined && size < min) {
        throw new ConstraintError(`File size must be at least ${min} bytes`);
      }
      if (max !== undefined && size > max) {
        throw new ConstraintError(`File size must be at most ${max} bytes`);
      }
      return value;
    } catch (error) {
      if (error instanceof ConstraintError) {
        throw error;
      }
      throw new ConstraintError(`Cannot access file: ${error.message}`);
    }
  },
  describe: (args) => {

    if (!args) {
      return undefined;  // should never happen
    }

    const minProcessor = (Array.isArray(args)? args[0] : args.min);
    const maxProcessor = (Array.isArray(args)? args[1] : args.max);

    const min = minProcessor?.description;
    const max = maxProcessor?.description;

    return min !== undefined && max !== undefined
           ? `${min}-${max}B`
           : min !== undefined
             ? `≥${min}B`
             : max !== undefined
               ? `≤${max}B`
               : undefined
  }

};
