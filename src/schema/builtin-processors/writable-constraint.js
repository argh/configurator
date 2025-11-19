import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path is writable (or parent directory is writable if path doesn't exist)
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
