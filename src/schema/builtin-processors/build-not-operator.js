import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$not`
 *
 * Inverts a processor - validation succeeds only if the wrapped processor fails.
 * This is useful for expressing negative constraints (e.g., "must not be a hostname").
 *
 * @example
 * ```javascript
 * // Reject values that look like hostnames
 * Schema.create('string').validator({$not: '$hostname'})
 *
 * // Reject values within a specific range
 * Schema.create('number').validator({$not: {$range: {min: 0, max: 100}}})
 *
 * // Complex negation with operators
 * Schema.create('string').validator({
 *   $not: {$or: ['$email', '$url']}
 * })
 *
 * // In a schema property
 * Schema.create('object', {
 *   nickname: Schema.create('string')
 *     .validator({$not: '$email'})
 *     .metadata({description: 'Username (not an email address)'})
 * })
 * ```
 *
 * **Parameters**:
 * - `processor` (string | object | function, required): A processor specification to negate.
 *   Can be any valid processor spec: keyword string, parameterized object, function, or RegExp.
 *
 * **Note**: If the wrapped processor throws an error, `$not` treats it as a "failed match"
 * and succeeds. If the wrapped processor succeeds (returns without error), `$not` throws
 * a ConstraintError.
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NOT_OPERATOR = {
  keyword: 'not',
  builder: (args, compileSpec) => {
    const compiled = compileSpec(args);
    const needParens = compiled.description && /[|& ]/.test(compiled.description);

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
