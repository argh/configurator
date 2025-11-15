import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * Compile the $range constraint - validates numeric ranges
 */
export const RANGE_CONSTRAINT = {
  compile: (args, compileSpec) => {
    if (typeof args !== 'object' || args === null) {
      throw new ResolverError('$range requires an object with min/max properties');
    }
    const { min, max } = args;

    return {
      validator: async (value) => {
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
