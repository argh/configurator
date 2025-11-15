import { ConstraintError } from '../../errors.js';

/**
 * Compile the $each operator - applies processor to each element of an array
 */
export const EACH_OPERATOR = {
  compile: (args, compileSpec) => {
    const compiled = compileSpec(args);

    return {
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
