import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$writable` (async)
 *
 * Validates that a file system path is writable by checking write permissions.
 * If the path does not exist, validates that the parent directory exists and is writable.
 *
 * This is an asynchronous processor that performs file system permission checks.
 *
 * @example
 * ```javascript
 * // Basic usage - validate output file path
 * Schema.create('string').validator('$writable')
 *
 * // Configuration file that must be writable
 * Schema.create('object', {
 *   outputFile: Schema.create('string').validator('$writable'),
 *   logFile: Schema.create('string').validator('$writable')
 * })
 *
 * // Combined with other validators
 * Schema.create('string')
 *   .validator('$file')      // Must be a file
 *   .validator('$writable')  // And must be writable
 * ```
 *
 * **Valid values**:
 * - Existing files with write permissions: `/tmp/output.log`, `./config.json`
 * - Non-existent paths in writable directories: `/tmp/new-file.txt`, `./data/output.csv`
 *
 * **Invalid values**:
 * - Read-only files: `/etc/hosts`, system-protected paths
 * - Paths in non-existent parent directories: `/nonexistent/dir/file.txt`
 * - Paths in read-only directories: `/read-only-mount/file.txt`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const WRITABLE_CONSTRAINT = {
  keyword: 'writable',
  processor: async (value) => {
    try {
      // Try to access the file
      await fs.access(value, constants.W_OK);
      return value;
    } catch (error) {
      // File doesn't exist or isn't writable
      if (error.code === 'ENOENT') {
        // File doesn't exist - check if parent directory is writable
        const path = await import('node:path');
        const parentDir = path.dirname(value);

        try {
          const stat = await fs.stat(parentDir);
          if (!stat.isDirectory()) {
            throw new ConstraintError('Parent path exists but is not a directory');
          }
          await fs.access(parentDir, constants.W_OK);
          return value; // Parent is writable
        } catch (parentError) {
          if (parentError.code === 'ENOENT') {
            throw new ConstraintError('Parent directory does not exist');
          }
          else if (parentError instanceof ConstraintError) {
            throw parentError;
          }
          throw new ConstraintError('Parent directory is not writable');
        }
      }
      throw new ConstraintError('File is not writable');
    }
  },
  description: 'path'
};
