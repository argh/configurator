import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Compile the $in constraint - validates value is in allowed list
 */
export const IN_CONSTRAINT = {
  compile: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$in requires an array of allowed values');
    }

    return {
      validator: async (value) => {
        if (!args.includes(value)) {
          throw new ConstraintError(`Value must be one of: ${args.join(', ')}`);
        }
        return value;
      },
      description: args.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('|')
    };
  }
};
