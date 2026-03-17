import { deepValue } from '../../utils.js';
import { SchemaError } from '../schema-errors.js';

/**
 * **Processor**: `$reference`
 *
 * Returns the value at the referenced path in the target data, or undefined if not set.
 *
 * Throws a `SchemaError` if the specified path is not defined in the schema.
 *
 * **Parameters**:
 * - `path` (string, required): The path in the schema hierarchy; must be defined.
 *
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
