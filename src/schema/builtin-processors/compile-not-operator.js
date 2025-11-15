import { ConstraintError } from '../../errors.js';

/**
 * Compile the $not operator - succeeds if the validator fails
 */
export const NOT_OPERATOR = {
  compile: (args, compileSpec) => {
    const compiled = compileSpec(args);
    const needParens = /[|& ]/.test(compiled.description);

    return {
      processor: async (...params) => {
        try {
          await compiled.processor(...params);
        }
        catch (error) {
          return params[0];
        }
        throw new ConstraintError('Value must not match the specified condition');
      },
      description: compiled.description
                   ? (needParens ? `!(${compiled.description})` : `!${compiled.description}`)
                   : undefined
    };
  }
};
