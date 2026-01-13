import * as fs from 'node:fs/promises';
import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$file` (async)
 *
 * Validates that a path exists in the filesystem and is a file (not a directory or other type).
 * Performs an asynchronous filesystem check using `fs.stat()`.
 *
 * This processor is asynchronous and must be used in phases that support async operations
 * (normalize, transform, validate).
 *
 * @example
 * ```javascript
 * // Validate configuration file path
 * Schema.create('string').validator('$file')
 *
 * // Validate log file path in a schema
 * Schema.create('object', {
 *   logFile: Schema.create('string').validator('$file'),
 *   dataFile: Schema.create('string').validator('$file')
 * })
 *
 * // Use in normalize phase for early validation
 * Schema.create('string')
 *   .normalizer('$file')
 *   .transformer((path) => fs.readFileSync(path, 'utf8'))
 * ```
 *
 * **Valid values**: `"/var/log/app.log"`, `"./config.json"`, `"~/documents/data.txt"` (if they exist as files)
 *
 * **Invalid values**:
 * - Non-existent paths: `"/does/not/exist.txt"` → throws "File does not exist"
 * - Directory paths: `"/var/log"` → throws "Path exists but is not a file"
 * - Inaccessible paths: `"/root/secret.txt"` (permission denied) → throws "Cannot access file: ..."
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FILE_CONSTRAINT = {
  keyword: 'file',
  processor: async (value) => {
    try {
      const stat = await fs.stat(value);
      if (!stat.isFile()) {
        throw new ConstraintError('Path exists but is not a file');
      }
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ConstraintError('File does not exist');
      }
      throw new ConstraintError(`Cannot access file: ${error.message}`);
    }
  }
};
