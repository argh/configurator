import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';
import { map } from '../../utils.js';

/**
 * **Processor**: `$concat`
 *
 * Returns a new array with the specified values appended to the input array.
 * Throws `SchemaError` at compile time if no arguments are provided.
 * Throws `ConstraintError` at runtime if the input is not an array.
 *
 * **Parameters**:
 * - Array of values to append (required, at least one).
 *
 * **Input**: `[1, 2]` with `{$concat: [3, 4]}` → **Output**: `[1, 2, 3, 4]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const CONCAT_OPERATOR = {
  keyword: 'concat',

  build: (args) => {
    if (!Array.isArray(args) || args.length === 0) {
      throw new SchemaError('$concat requires a non-empty array of values to append');
    }

    const argsSpec = map(args, v => v.spec);

    return new FunctionValueProcessor(
      (value, _target, location, options) => {
        const items = Array.isArray(options.args) ? options.args : [];
        if (!Array.isArray(value)) {
          throw new ConstraintError(`$concat requires an array input, got ${value}`, {location});
        }
        return [...value, ...items];
      },
      new ComposedValueProcessor(new ArrayExecutor(args), argsSpec)
    );
  }
};
