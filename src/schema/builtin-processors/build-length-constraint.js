import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Build the $length constraint - validates length of strings or arrays
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const LENGTH_CONSTRAINT = {
  build: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$length requires an object with min/max/exact properties');
    }
    const { min, max, exact } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        const length = Array.isArray(value) ? value.length : String(value).length;
        const unit = Array.isArray(value) ? 'elements' : 'characters';

        if (exact !== undefined && length !== exact) {
          throw new ConstraintError(`Length must be exactly ${exact} ${unit}`);
        }
        if (min !== undefined && length < min) {
          throw new ConstraintError(`Length must be at least ${min} ${unit}`);
        }
        if (max !== undefined && length > max) {
          throw new ConstraintError(`Length must be at most ${max} ${unit}`);
        }
        return value;
      },
      description: exact !== undefined
                   ? `len=${exact}`
                   : min !== undefined && max !== undefined
                     ? `len=${min}-${max}`
                     : min !== undefined
                       ? `len≥${min}`
                       : max !== undefined
                         ? `len≤${max}`
                         : undefined
    };
  }
};
