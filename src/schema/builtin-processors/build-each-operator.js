import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$each`
 *
 * Applies a processor to each element of an array. The processor can be any valid
 * processor specification (RegExp, function, keyword, or parameterized processor).
 * If any element fails validation, the entire array is rejected.
 *
 * This operator is useful for applying consistent validation or transformation rules
 * across all array elements without requiring explicit array element schemas.
 *
 * @example
 * ```javascript
 * // Validate each element matches a pattern
 * Schema.create('array').validator({$each: /^\d+$/})
 *
 * // Apply a registered processor to each element
 * Schema.create('array').validator({$each: '$numeric'})
 *
 * // Transform each element with a function
 * Schema.create('array').normalizer({$each: (v) => v.trim()})
 *
 * // Combine with other processors using $and
 * Schema.create('array').validator({
 *   $each: {$and: [/^test/, {$length: {min: 5}}]}
 * })
 *
 * // Real-world example: array of valid port numbers
 * Schema.create('object', {
 *   ports: Schema.create('array').validator({
 *     $each: {$range: {min: 1, max: 65535}}
 *   })
 * })
 * ```
 *
 * **Parameters**:
 * - `processor` (any valid processor spec, required): The processor to apply to each element.
 *   Can be a RegExp, function, string keyword (e.g., `'$numeric'`), or parameterized processor object.
 *
 * **Valid values**: Any array where all elements satisfy the specified processor
 *
 * **Invalid values**: Non-array values, or arrays where any element fails the processor
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const EACH_OPERATOR = {
  keyword: 'each',
  builder: (args, compileSpec) => {
    const compiled = compileSpec(args);

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, schema, path, options) => {
        if (!Array.isArray(value)) {
          throw new ConstraintError('Value must be an array');
        }
        const ret = [];
        // try to return original if possible...
        let same = true;
        for (const item of value) {
          const processed = await compiled.processor(item, configuration, schema, path, options);
          if (processed !== item) {
            same = false;
          }
          ret.push(processed);
        }
        return same ? value : ret;
      },
      description: compiled.description !== undefined ? `[${compiled.description}]...` : 'values...'
    };
  }
};
