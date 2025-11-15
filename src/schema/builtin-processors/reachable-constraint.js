import { lookup } from 'node:dns/promises';
import { ConstraintError } from '../../errors.js';

/**
 * Validate that hostname is reachable via DNS lookup
 */
export const REACHABLE_CONSTRAINT = {
  process: async (value) => {
    try {
      await lookup(value);
      return value;
    } catch {
      throw new ConstraintError('Host is not reachable');
    }
  }
};
