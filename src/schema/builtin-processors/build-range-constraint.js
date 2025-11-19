import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Build the $range constraint - validates numeric ranges
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const RANGE_CONSTRAINT = {
  keyword: 'range',
  builder: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$range requires an object with min/max properties');
    }
    const { min, max } = args;

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          throw new ConstraintError('Value must be a number');
        }
        if (min !== undefined && num < min) {
          throw new ConstraintError(`Value must be at least ${min}`);
        }
        if (max !== undefined && num > max) {
          throw new ConstraintError(`Value must be at most ${max}`);
        }
        return value;
      },
      description: min !== undefined && max !== undefined
                   ? `${min}-${max}`
                   : min !== undefined
                     ? `≥${min}`
                     : max !== undefined
                       ? `≤${max}`
                       : undefined
    };
  }
};
