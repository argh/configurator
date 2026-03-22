import { deepValue } from '../../utils.js';
import { SchemaError } from '../schema-errors.js';

/**
 * ## $reference
 *
 * Returns the value at the referenced path in the target data, or undefined if not set.
 *
 * Throws a `SchemaError` if the specified path is not defined in the schema.
 *
 * ### Parameters
 * - `path` (string, required): Dot-separated path into the top-level target object; must be a valid
 *   schema path. Use `$get` for accessing arbitrary paths without schema validation.
 *
 * ### Example
 * ```js
 * // Validate 'port' is within range only when 'ssl' is enabled at the top level
 * new Schema('object', {
 *   ssl: new Schema('boolean'),
 *   port: new Schema('number').validator({
 *     $if: [{$reference: 'ssl'}, {$range: {min: 443, max: 443}}]
 *   }),
 * })
 *
 * // Cross-field consistency: confirm 'passwordConfirm' matches 'password'
 * new Schema('object', {
 *   password: new Schema('string'),
 *   passwordConfirm: new Schema('string').validator(
 *     (value, target) => value === target.password || undefined
 *   ),
 * })
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const REFERENCE_OPERATOR = {
  keyword: 'reference',
  parameters: [{parameter: 'path', required: true}],
  process: (_, target, location, options) => {
    const path = options.args.path;
    if (path === undefined) {
      throw new SchemaError('$reference expects a path')
    }
    const pathLocation = location.absolute(path);

    if (pathLocation === undefined) {
      throw new SchemaError(`Unknown path ${path}`);
    }
    return deepValue(target, path);
  },
  /*
      description: `${path}`
    };
  }

   */
};
