import { ConstraintError, ResolverError } from '../../errors.js';

/**
 * Build the $filter operator - returns undefined on exceptions, otherwise passes
 */
export const FILTER_OPERATOR = {
  build: (args, compileSpec) => {
    const compiled = compileSpec(args);

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (...params) => {
        try {
          await compiled.processor(...params);
        }
        catch (error) {
          return undefined;
        }
      }
    };
  }
};
