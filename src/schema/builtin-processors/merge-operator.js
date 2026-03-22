import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ObjectExecutor } from '../executor/object-executor.js';

/**
 * ## $merge
 *
 * Merges the argument object into the input object (shallow). The argument fields take
 * precedence over same-named fields in the input, consistent with the "apply to the
 * value being passed through" pattern.
 *
 * The input object is not mutated; a new object is returned.
 *
 * ### Parameters
 * - Object of fields to merge (object, required): Key/value pairs to apply over the input.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MERGE_OPERATOR = {
  keyword: 'merge',

  build: (args) => {
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new SchemaError('$merge requires an object argument');
    }

    const argsSpec = Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, v?.spec ?? v])
    );

    return new FunctionValueProcessor(
      (value, _target, location, options) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ConstraintError(`$merge requires a plain object input`, {location});
        }
        return {...value, ...options.args};
      },
      new ComposedValueProcessor(new ObjectExecutor(args), {$merge: argsSpec})
    );
  }
};
