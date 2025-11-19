import * as fs from 'node:fs/promises';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path exists and is a file
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
