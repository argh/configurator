import { ResolverError, ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$in`
 *
 * Validates that a value is included in an allowed list of values.
 * Uses strict equality (===) for comparison.
 *
 * @example
 * ```javascript
 * // Validate against a list of allowed strings
 * Schema.create('string').validator({$in: ['development', 'staging', 'production']})
 *
 * // Validate against numeric values
 * Schema.create('number').validator({$in: [80, 443, 8080, 8443]})
 *
 * // Environment configuration example
 * Schema.create('object', {
 *   environment: Schema.create('string')
 *     .validator({$in: ['development', 'staging', 'production']}),
 *   logLevel: Schema.create('string')
 *     .validator({$in: ['debug', 'info', 'warn', 'error']})
 * })
 *
 * // Mixed types (though not recommended)
 * Schema.create('string').validator({$in: ['auto', 0, null, false]})
 * ```
 *
 * **Parameters**:
 * The parameter is an array (not an object) of allowed values passed directly to the processor.
 * - Array of values (array, required): The allowed values to match against using strict equality
 *
 * **Valid values**: Any value that matches (using `===`) an element in the allowed array
 *
 * **Invalid values**: Any value not present in the allowed array
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const IN_CONSTRAINT = {
  keyword: 'in',
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$in requires an array of allowed values');
    }

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value) => {
        if (!args.includes(value)) {
          throw new ConstraintError(`Value must be one of: ${args.join(', ')}`);
        }
        return value;
      },
      description: args.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('|')
    };
  }
};
