import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Build the $in constraint - validates value is in allowed list
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const IN_CONSTRAINT = {
  build: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$in requires an array of allowed values');
    }

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        if (!args.includes(value)) {
          throw new ConstraintError(`Value must be one of: ${args.join(', ')}`);
        }
        return value;
      },
      description: args.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('|')
    };
  }
};
