import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

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
 * @example
 * ```javascript
 * // Basic usage - validate executable path
 * Schema.create('string').validator('$executable')
 *
 * // Application configuration with executable paths
 * Schema.create('object', {
 *   shellScript: Schema.create('string').validator('$executable'),
 *   binaryPath: Schema.create('string').validator('$executable')
 * })
 *
 * // Combined with file validator
 * Schema.create('string')
 *   .validator('$file')        // Must exist as a file
 *   .validator('$executable')  // Must be executable
 * ```
 *
 * **Valid values**: `/usr/bin/node`, `/bin/bash`, `./scripts/deploy.sh` (if executable)
 *
 * **Invalid values**: Non-existent paths, files without execute permission, directories
 *
 * **Note**: This processor performs async file system checks and should be used in
 * validation phase. Execution permissions are platform-dependent (Unix/Linux/macOS
 * use chmod +x; Windows uses file extensions and ACLs).
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const EXECUTABLE_CONSTRAINT = {
  keyword: 'executable',
  processor: async (value) => {
    try {
      await fs.access(value, constants.X_OK);
      return value;
    } catch {
      throw new ConstraintError('File is not executable');
    }
  },
  description: 'path'
};
