import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ObjectExecutor } from '../executor/object-executor.js';
import { deepMerge } from '../../utils.js';

/**
 * ## $merge-deep
 *
 * Recursively deep-merges the argument object into the input object, returning
 * a new object. Nested plain objects are merged rather than replaced; arrays
 * and primitive values are overwritten. The input is not mutated.
 *
 * Use `$merge` for shallow (one-level) merging.
 *
 * ### Parameters
 * - Object of fields to deep-merge (object, required): Key/value pairs to apply over the input.
 *
 * **Output**: `{a: {x: 1, y: 99, z: 3}}`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MERGE_DEEP_OPERATOR = {
  keyword: 'merge-deep',

  build: (args) => {
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new SchemaError('$merge-deep requires an object argument');
    }

    const argsSpec = Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, v?.spec ?? v])
    );

    return new FunctionValueProcessor(
      (value, _target, location, options) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ConstraintError(`$merge-deep requires a plain object input`, {location});
        }
        return deepMerge({}, value, options.args);
      },
      new ComposedValueProcessor(new ObjectExecutor(args), {'$merge-deep': argsSpec})
    );
  }
};
