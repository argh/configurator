import { ResolverError, SchemaError } from '../../errors.js';
import { deepValue } from '../../utils.js';

/**
 * **Processor**: `$reference`
 *
 * Returns the value at the referenced path in the target data, or undefined if not set.
 *
 * Throws a `SchemaError` if the specified path is not defined in the schema.
 *
 * @example
 * ```javascript
 * new Schema('object')
 *   .property('app', new Schema('object')
 *     .property('devMode', new Schema('boolean').meta('advanced'))
 *   )
 *   .property('service', new Schema('object')
 *     .property('reset', new Schema('boolean')
 *       .condition({$pipeline: [{$reference: 'app.devMode'}, true]})
 *   )
 * )
 * ```
 *
 * **Parameters**:
 * - `path` (string, required): The path in the schema hierarchy; must be defined.
 *
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const REFERENCE_OPERATOR = {
  keyword: 'reference',
  builder: (path) => {
    if (path === undefined) {
      // todo - expand contract with spec compilation to pass a schema so we can verify path earlier?
      throw new ResolverError('$reference expects a path')
    }

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (current, target, location) => {
        const pathLocation = location.absolute(path);

        if (pathLocation === undefined) {
          throw new SchemaError(`Unknown path ${path}`);
        }
        return deepValue(target, path);
      },
      description: `${path}`
    };
  }
};
