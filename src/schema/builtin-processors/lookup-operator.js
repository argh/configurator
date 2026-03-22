import { SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ObjectExecutor } from '../executor/object-executor.js';

/**
 * ## $lookup
 *
 * Uses the pipeline value as a key to look up a corresponding value from the argument
 * collection. This is the inverse of `$get`: the value is the key, the argument is the
 * collection.
 *
 * Returns `undefined` if the key is not found in the collection.
 *
 * ### Parameters
 * - Object collection (object, required): The key/value lookup table.
 *
 * ### Example
 * ```js
 * // Map a string value to a numeric code
 * new Schema('string').transformer({$lookup: {low: 1, medium: 2, high: 3}})
 * // 'medium' → 2
 *
 * // Use a role name to look up its permission set
 * new Schema('string').transformer({
 *   $lookup: {
 *     admin: ['read', 'write', 'delete'],
 *     editor: ['read', 'write'],
 *     viewer: ['read'],
 *   }
 * })
 *
 * // Validate that a key exists in the table (require a defined result)
 * new Schema('string').validator({
 *   $require: {$lookup: {us: 'United States', uk: 'United Kingdom', ca: 'Canada'}}
 * })
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const LOOKUP_OPERATOR = {
  keyword: 'lookup',

  build: (args) => {
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new SchemaError('$lookup requires an object argument (the lookup table)');
    }

    const argsSpec = Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, v?.spec ?? v])
    );

    return new FunctionValueProcessor(
      (value, _target, _location, options) => {
        return options.args?.[value];
      },
      new ComposedValueProcessor(new ObjectExecutor(args), {$lookup: argsSpec})
    );
  }
};
