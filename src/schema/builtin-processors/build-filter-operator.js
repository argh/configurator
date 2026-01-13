import { ConstraintError, ResolverError } from '../../errors.js';

/**
 * **Processor**: `$filter`
 *
 * Wraps a processor and returns `undefined` if it throws an error, otherwise returns
 * the processed value. This is primarily used with `$each` to filter array elements
 * based on whether they satisfy a condition.
 *
 * When a processor wrapped in `$filter` throws an error (e.g., validation fails),
 * the error is caught and `undefined` is returned instead. This allows array processing
 * with `$each` to silently remove elements that don't match the criteria.
 *
 * @example
 * ```javascript
 * // Filter array to only include valid email addresses
 * Schema.create('array')
 *   .normalizer({$each: {$filter: '$email'}})
 *
 * // Filter array to only include numbers in a specific range
 * Schema.create('array')
 *   .normalizer({$each: {$filter: {$range: {min: 0, max: 100}}}})
 *
 * // Filter array to only include valid hostnames, trimmed and lowercased
 * Schema.create('array')
 *   .normalizer({$each: {$filter: {$pipeline: ['$trim', '$lowercase', '$hostname']}}})
 *
 * // Complex filtering with multiple criteria
 * Schema.create('object', {
 *   validPorts: Schema.create('array')
 *     .normalizer({$each: {$filter: {$and: ['$integer', {$range: {min: 1, max: 65535}}]}}})
 *     .metadata({description: 'List of valid port numbers'})
 * })
 * ```
 *
 * **Parameters**:
 * - `processor` (string | object | function, required): A processor specification to apply.
 *   Can be any valid processor spec: keyword string, parameterized object, function, or RegExp.
 *   If the processor throws an error, `undefined` is returned; otherwise the processed value is returned.
 *
 * **Note**: When used with `$each`, array elements that result in `undefined` are typically
 * removed from the array. This makes `$filter` ideal for normalizing arrays by removing invalid
 * or unwanted elements during the normalization phase.
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FILTER_OPERATOR = {
  keyword: 'filter',
  builder: (args, compileSpec) => {
    const compiled = compileSpec(args);

    return {
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (...params) => {
        try {
          return await compiled.processor(...params);
        }
        catch (error) {
          return undefined;
        }
      }
    };
  }
};
