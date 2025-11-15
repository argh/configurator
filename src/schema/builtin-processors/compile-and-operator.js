import { ResolverError } from '../../errors.js';

/**
 * Compile the $and operator - all processors must pass
 */
export const AND_OPERATOR = {
  compile: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$and requires an array of processors');
    }
    const compiled = args.map(v => compileSpec(v));
    const descriptions = compiled.map(c => c.description).filter(Boolean);

    return /** @type {import('../compiled-schema.js').CompiledSchemaOptions} */ ({
      validator: async (...params) => {
        let v = params[0];
        for (const {validator} of compiled) {
          v = await validator(v, ...params.slice(1));
        }
        return v;
      },
      description: descriptions.length > 1
                   ? descriptions.map(d => d.includes('|') ? `(${d})` : d).join(' & ')
                   : descriptions[0]
    });
  }
};
