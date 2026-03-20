import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';
import { map } from '../../utils.js';

/**
 * **Processor**: `$pick`
 *
 * Returns a new object or dense array containing only the specified keys/indices from the input.
 * Keys not present in the input are silently omitted from the result.
 * For arrays, numeric indices are selected and the result is a dense (packed) array.
 *
 * **Parameters**:
 * - Array of key names or indices (string[]|number[], required): The keys/indices to retain.
 *
 * **Input**: `{a: 1, b: 2, c: 3}` with `{$pick: ['a', 'c']}` → **Output**: `{a: 1, c: 3}`
 * **Input**: `[10, 20, 30]` with `{$pick: [0, 2]}` → **Output**: `[10, 30]`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const PICK_OPERATOR = {
  keyword: 'pick',

  build: (args) => {
    if (!Array.isArray(args) || args.length === 0) {
      throw new SchemaError('$pick requires a non-empty array of key names');
    }

    const argsSpec = map(args, v => v.spec);

    return new FunctionValueProcessor(
      (value, _target, location, options) => {
        const keys = Array.isArray(options.args) ? options.args : [];
        if (typeof value !== 'object' || value === null) {
          throw new ConstraintError(`$pick requires an object or array input`, {location});
        }
        if (Array.isArray(value)) {
          return keys.filter(k => k >= 0 && k < value.length).map(k => value[k]);
        }
        const result = {};
        for (const k of keys) {
          if (k in value) result[k] = value[k];
        }
        return result;
      },
      new ComposedValueProcessor(new ArrayExecutor(args), argsSpec)
    );
  }
};
