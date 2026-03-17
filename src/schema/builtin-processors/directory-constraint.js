import * as fs from 'node:fs/promises';

import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$directory`
 *
 * Validates that a path exists on the filesystem and is a directory (not a file).
 * This is an **async processor** that performs filesystem operations.
 *
 * The processor checks both existence and type, throwing distinct errors for:
 * - Path does not exist (ENOENT)
 * - Path exists but is a file, symlink, or other non-directory type
 * - Path is inaccessible due to permissions or other filesystem errors
 *
 * **Valid values**: `/tmp`, `/etc`, `./node_modules`, `../src`, `/Users/username/Documents`
 *
 * **Invalid values**: `/etc/hosts` (file), `/nonexistent/path`, `` (empty string)
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const DIRECTORY_CONSTRAINT = {
  keyword: 'directory',
  process: async (value) => {
    try {
      const stat = await fs.stat(value);
      if (!stat.isDirectory()) {
        throw new ConstraintError('Path exists but is not a directory');
      }
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ConstraintError('Directory does not exist');
      }
      throw new ConstraintError(`Cannot access directory: ${error.message}`);
    }
  }
};
