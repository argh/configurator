import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$or`
 *
 * Combines multiple processors using logical OR - succeeds if at least one processor passes.
 * Attempts each processor in order until one succeeds. If all processors fail, throws an error
 * combining all failure messages.
 *
 * @example
 * ```javascript
 * // Accept either a number or a numeric string
 * Schema.create('string').normalizer({$or: ['$number', '$string']})
 *
 * // Accept multiple formats
 * Schema.create('string').validator({$or: ['$email', '$url', '$hostname']})
 *
 * // Combine with other constraints
 * Schema.create('object', {
 *   identifier: Schema.create('string').validator({
 *     $or: ['$uuid', '$alphanum']
 *   })
 * })
 *
 * // Complex example with nested operators
 * Schema.create('number').validator({
 *   $or: [
 *     {$range: {min: 0, max: 100}},
 *     {$range: {min: 1000, max: 2000}}
 *   ]
 * })
 * ```
 *
 * **Parameters**:
 * - `processors` (Array<ProcessorSpec>, required): Array of processor specifications to try.
 *   Each element can be a processor keyword (string), function, regex, or parameterized processor.
 *
 * **Valid values**: Any value that passes at least one of the specified processors
 *
 * **Invalid values**: Values that fail all specified processors
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const OR_OPERATOR = {
  keyword: 'or',
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$or requires an array of validators');
    }
    const compiled = args.map(v => compileSpec(v));
    const descriptions = compiled.map(c => c.description).filter((d) => d !== undefined);

    const description = descriptions.length > 1
                            ? descriptions.map(d => d.includes('&') ? `(${d})` : d).join('|')
                            : descriptions[0]
    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (v, t, l, o) => {
        const errors = [];
        for (const {processor} of compiled) {
          try {
            await processor(v, t, l, o);
            return v;
          } catch (error) {
            errors.push(error.message);
          }
        }
        throw new ConstraintError(`None of {${description}} matched`, {errors});
      },
      description
    };
  }
};
