import * as fs from 'node:fs/promises';

import { ConstraintError } from '../schema-errors.js';

/**
 * ## $file
 *
 * Validates that a path exists in the filesystem and is a file (not a directory or other type).
 * Performs an asynchronous filesystem check using `fs.stat()`.
 *
 * - Non-existent paths: `"/does/not/exist.txt"` → throws "File does not exist"
 * - Directory paths: `"/var/log"` → throws "Path exists but is not a file"
 * - Inaccessible paths: `"/root/secret.txt"` (permission denied) → throws "Cannot access file: ..."
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const FILE_CONSTRAINT = {
  keyword: 'file',
  process: async (value) => {
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
