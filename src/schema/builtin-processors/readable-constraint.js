import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$readable` (async)
 *
 * Validates that a file or directory path exists and has read permissions for the
 * current process. Performs an asynchronous file system access check.
 *
 * This processor uses Node.js `fs.access()` with `R_OK` flag to verify read permissions
 * without actually opening the file. Note that permission checks can be subject to race
 * conditions where permissions change between validation and actual file access.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$readable')
 *
 * // Validate configuration file path
 * Schema.create('object', {
 *   configFile: Schema.create('string')
 *     .validator('$file')
 *     .validator('$readable')
 * })
 *
 * // Combined with other file validators
 * Schema.create('object', {
 *   inputFile: Schema.create('string')
 *     .validator({$and: ['$file', '$readable']})
 * })
 * ```
 *
 * **Valid values**: Any file or directory path that exists and has read permissions
 * (e.g., `"/etc/hosts"`, `"./config.json"`, `"~/Documents"`)
 *
 * **Invalid values**: Non-existent paths, paths without read permissions,
 * or non-string values
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const READABLE_CONSTRAINT = {
  keyword: 'readable',
  processor: async (value) => {
    try {
      await fs.access(value, constants.R_OK);
      return value;
    } catch {
      throw new ConstraintError('File is not readable');
    }
  },
  description: 'path'
};
