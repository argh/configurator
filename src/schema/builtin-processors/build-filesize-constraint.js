import * as fs from 'node:fs/promises';
import { ConstraintError, ResolverError } from '../../errors.js';

/**
 * **Processor**: `$filesize` (async, parameterized)
 *
 * Validates that a file's size falls within the specified range. Accepts size constraints
 * in bytes and checks the file's metadata without loading the entire file into memory.
 * Can specify minimum, maximum, or both bounds.
 *
 * **This is an async processor** that performs filesystem I/O and must be used in the
 * validation phase (not normalization phase).
 *
 * @example
 * ```javascript
 * // Require file between 1KB and 10MB
 * // Note: sizes must be specified in bytes
 * const KB = 1024;
 * const MB = 1024 * KB;
 * Schema.create('string').validator({$filesize: {min: 1 * KB, max: 10 * MB}})
 *
 * // At least 100 bytes (no upper bound)
 * Schema.create('string').validator({$filesize: {min: 100}})
 *
 * // At most 5MB (no lower bound)
 * Schema.create('string').validator({$filesize: {max: 5 * 1024 * 1024}})
 *
 * // Common use case: configuration file with reasonable size limits
 * const KB = 1024;
 * const MB = 1024 * KB;
 * Schema.create('object', {
 *   configFile: Schema.create('string')
 *     .validator('$file')              // Ensure file exists
 *     .validator({$filesize: {         // Then check size
 *       min: 1,                        // At least 1 byte (not empty)
 *       max: 1 * MB                    // At most 1MB
 *     }}),
 *
 *   logFile: Schema.create('string')
 *     .validator('$file')
 *     .validator({$filesize: {
 *       max: 100 * MB                  // Max 100MB log file
 *     }}),
 *
 *   uploadedImage: Schema.create('string')
 *     .validator('$file')
 *     .validator({$filesize: {
 *       min: 1 * KB,                   // At least 1KB
 *       max: 5 * MB                    // At most 5MB
 *     }})
 * })
 * ```
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
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FILESIZE_CONSTRAINT = {
  keyword: 'filesize',
  builder: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$filesize requires an object with min/max properties');
    }
    const { min, max } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
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
      description: min !== undefined && max !== undefined
                   ? `${min}-${max}B`
                   : min !== undefined
                     ? `≥${min}B`
                     : max !== undefined
                       ? `≤${max}B`
                       : undefined
    };
  }
};
