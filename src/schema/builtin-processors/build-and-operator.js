import { ResolverError } from '../../errors.js';

/**
 * **Processor**: `$and`
 *
 * Combines multiple processors where all must pass for the value to be valid.
 * Processors are executed sequentially, with each processor receiving the output
 * of the previous one. If any processor throws an error, the entire chain fails.
 *
 * @example
 * ```javascript
 * // Require string that is both non-empty and alphanumeric
 * Schema.create('string').validator({$and: ['$nonempty', '$alphanum']})
 *
 * // Combine multiple constraints on a number
 * Schema.create('number').validator({
 *   $and: [
 *     {$range: {min: 0, max: 100}},
 *     '$integer'
 *   ]
 * })
 *
 * // In a schema property
 * Schema.create('object')
 *   .property('username', Schema.create('string')
 *     .validator({$and: ['$nonempty', '$alphanum', {$length: {min: 3, max: 20}}]})
 * )
 * ```
 *
 * **Parameters**:
 * - `processors` (Array, required): Array of processor specifications. Each element can be:
 *   - String keyword (e.g., `'$hostname'`)
 *   - RegExp pattern (e.g., `/^\d+$/`)
 *   - Function processor
 *   - Parameterized processor object (e.g., `{$range: {min: 0, max: 100}}`)
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const AND_OPERATOR = {
  keyword: 'and',
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$and requires an array of processors');
    }
    const compiled = args.map(v => compileSpec(v));
    const descriptions = compiled.map(c => c.description).filter((d) => d !== undefined);

    return ({
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, location, options) => {
        for (const {processor} of compiled) {
          await processor(value, configuration, location, options);
        }
        return value;
      },
      description: descriptions.length > 1
                   ? descriptions.map(d => d.includes('|') ? `(${d})` : d).join(' & ')
                   : descriptions[0]
    });
  }
};
