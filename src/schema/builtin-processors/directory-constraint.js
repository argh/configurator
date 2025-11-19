import * as fs from 'node:fs/promises';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path exists and is a directory
 */
export const DIRECTORY_CONSTRAINT = {
  keyword: 'directory',
  processor: async (value) => {
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
