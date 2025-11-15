import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path is executable
 */
export const EXECUTABLE_CONSTRAINT = {
  process: async (value) => {
    try {
      await fs.access(value, constants.X_OK);
      return value;
    } catch {
      throw new ConstraintError('File is not executable');
    }
  },
  describe: () => 'path'
};
