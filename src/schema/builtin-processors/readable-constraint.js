import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that path is readable
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
