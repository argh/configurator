import { ResolverError } from '../../errors.js';

/**
 * Build the $and operator from provided args - all processors must pass
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const AND_OPERATOR = {
  keyword: 'and',
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$and requires an array of processors');
    }
    const compiled = args.map(v => compileSpec(v));
    const descriptions = compiled.map(c => c.description).filter(Boolean);

    return ({
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, schema, path, options) => {
        let v = value;
        for (const {processor} of compiled) {
          v = await processor(v, configuration, schema, path, options);
        }
        return v;
      },
      description: descriptions.length > 1
                   ? descriptions.map(d => d.includes('|') ? `(${d})` : d).join(' & ')
                   : descriptions[0]
    });
  }
};
