import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path is readable
 */
export const READABLE_CONSTRAINT = {
  process: async (value) => {
    try {
      await fs.access(value, constants.R_OK);
      return value;
    } catch {
      throw new ConstraintError('File is not readable');
    }
  },
  describe: () => 'path'
};
