import { ConstraintError, SchemaError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { EachExecutor } from '../executor/each-executor.js';

/**
 * ## $group-by
 *
 * Groups an array of objects by a key, returning an object whose values are arrays of elements
 * that share that key value.
 *
 * - `{'$group-by': 'key'}` — groups by the named property on each element
 * - `{'$group-by': processor}` — groups by the result of executing the processor against each element
 *   (any compiled processor spec, e.g. `'$type'`, `{$get: 'field'}`, or a function)
 *
 * Elements where the extracted key is `undefined` are omitted from the result.
 * Insertion order is preserved within each group.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const GROUP_BY_OPERATOR = {
  keyword: 'group-by',

  build: (args) => {
    if (!Array.isArray(args) || args.length !== 1) {
      throw new SchemaError('$group-by requires a single key or processor argument');
    }

    const keyArg = args[0];
    const keySpec = keyArg?.spec;

    // Plain property name strings (no leading $) → property lookup per element.
    // Processor keywords ($type), complex specs, functions → execute as extractor.
    const keyExtractor = (typeof keySpec === 'string' && !keySpec.startsWith('$'))
      ? new FunctionValueProcessor(element => element?.[keySpec])
      : keyArg;

    return new ComposedValueProcessor(
      new EachExecutor(
        keyExtractor,
        (input) => {
          if (!Array.isArray(input)) {
            throw new ConstraintError(`$group-by requires an array, got ${formatValue(input)}`);
          }
          return input;
        },
        (keys, input) => {
          const result = {};
          for (let i = 0; i < input.length; i++) {
            const key = keys[i];
            if (key === undefined) continue;
            const groupKey = String(key);
            if (!result[groupKey]) result[groupKey] = [];
            result[groupKey].push(input[i]);
          }
          return result;
        }
      ),
      {'$group-by': keySpec}
    );
  }
};
