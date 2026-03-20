import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';
import { map } from '../../utils.js';

/**
 * **Processor**: `$omit`
 *
 * Returns a new object or dense array with the specified keys/indices removed.
 * Keys not present in the input are silently ignored.
 * For arrays, numeric indices are excluded and the result is a dense (packed) array.
 *
 * **Parameters**:
 * - Array of key names or indices (string[]|number[], required): The keys/indices to exclude.
 *
 * **Input**: `{a: 1, b: 2, c: 3}` with `{$omit: ['b']}` → **Output**: `{a: 1, c: 3}`
 * **Input**: `[10, 20, 30]` with `{$omit: [1]}` → **Output**: `[10, 30]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const OMIT_OPERATOR = {
  keyword: 'omit',

  build: (args) => {
    if (!Array.isArray(args) || args.length === 0) {
      throw new SchemaError('$omit requires a non-empty array of key names');
    }

    const argsSpec = map(args, v => v.spec);

    return new FunctionValueProcessor(
      (value, _target, location, options) => {
        const keys = Array.isArray(options.args) ? options.args : [];
        if (typeof value !== 'object' || value === null) {
          throw new ConstraintError(`$omit requires an object or array input`, {location});
        }
        if (Array.isArray(value)) {
          return value.filter((_v, i) => !keys.includes(i));
        }
        return Object.fromEntries(
          Object.entries(value).filter(([k]) => !keys.includes(k))
        );
      },
      new ComposedValueProcessor(new ArrayExecutor(args), argsSpec)
    );
  }
};
