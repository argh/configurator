import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';

import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$executable` (async)
 *
 * Validates that a file path points to an executable file by checking execute
 * permissions. This is an asynchronous processor that performs a file system
 * access check.
 *
 * This processor is particularly useful for validating script paths, binary
 * paths, and command executables in configuration files.
 *
 * **Valid values**: `/usr/bin/node`, `/bin/bash`, `./scripts/deploy.sh` (if executable)
 *
 * **Invalid values**: Non-existent paths, files without execute permission, directories
 *
 * **Note**: This processor performs async file system checks and should usually
 * be used as a validator. Execution permissions are platform-dependent (Unix/Linux/macOS
 * use chmod +x; Windows uses file extensions and ACLs).
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const EXECUTABLE_CONSTRAINT = {
  keyword: 'executable',
  process: async (value) => {
    try {
      await fs.access(value, constants.X_OK);
      return value;
    } catch {
      throw new ConstraintError('File is not executable');
    }
  },
  description: 'path'
};
