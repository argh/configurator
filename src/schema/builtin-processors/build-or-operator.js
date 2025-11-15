import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Build the $or operator - succeeds if any of the processors pass
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const OR_OPERATOR = {
  build: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$or requires an array of validators');
    }
    const compiled = args.map(v => compileSpec(v));
    const descriptions = compiled.map(c => c.description).filter(Boolean);

    const description = descriptions.length > 1
                            ? descriptions.map(d => d.includes('&') ? `(${d})` : d).join('|')
                            : descriptions[0]
    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (v, c, s, p, o) => {
        const errors = [];
        for (const {processor} of compiled) {
          try {
            return await processor(v, c, s, p, o);
          } catch (error) {
            errors.push(error.message);
          }
        }
        throw new ConstraintError(`None of {${description}} matched`, {errors});
      },
      description
    };
  }
};
