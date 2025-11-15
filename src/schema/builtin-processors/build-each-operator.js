import { ConstraintError } from '../../errors.js';

/**
 * Build the $each operator - applies processor to each element of an array
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const EACH_OPERATOR = {
  build: (args, compileSpec) => {
    const compiled = compileSpec(args);

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (...params) => {
        const value = params[0];
        if (!Array.isArray(value)) {
          throw new ConstraintError('Value must be an array');
        }
        const ret = [];
        for (const item of value) {
          ret.push(await compiled.processor(item, ...params.slice(1)));
        }
        return ret;
      },
      description: compiled.description !== undefined ? `[${compiled.description}]...` : 'values...'
    };
  }
};
