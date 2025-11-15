import { ConstraintError } from '../../errors.js';

/**
 * Build the $not operator - succeeds if the validator fails
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NOT_OPERATOR = {
  build: (args, compileSpec) => {
    const compiled = compileSpec(args);
    const needParens = /[|& ]/.test(compiled.description);

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
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
