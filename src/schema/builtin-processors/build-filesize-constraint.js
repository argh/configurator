import * as fs from 'node:fs/promises';
import { ConstraintError, ResolverError } from '../../errors.js';

/**
 * Build the $filesize constraint processor - validates file size ranges
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FILESIZE_CONSTRAINT = {
  build: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$filesize requires an object with min/max properties');
    }
    const { min, max } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        try {
          const stat = await fs.stat(value);
          const size = stat.size;

          if (min !== undefined && size < min) {
            throw new ConstraintError(`File size must be at least ${min} bytes`);
          }
          if (max !== undefined && size > max) {
            throw new ConstraintError(`File size must be at most ${max} bytes`);
          }
          return value;
        } catch (error) {
          if (error instanceof ConstraintError) {
            throw error;
          }
          throw new ConstraintError(`Cannot access file: ${error.message}`);
        }
      },
      description: min !== undefined && max !== undefined
                   ? `${min}-${max}B`
                   : min !== undefined
                     ? `≥${min}B`
                     : max !== undefined
                       ? `≤${max}B`
                       : undefined
    };
  }
};
