import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { formatValue } from '../../errors.js';
import { EachExecutor } from '../executor/each-executor.js';
import { isPlainObject } from '../../utils.js';

/** @import { ValueProcessorDefinition } from '../value-processor/value-processor.js' */

/**
 * **Processor**: `$map`
 *
 * Polymorphic map operator. Applies a processor to each element of an array, or to each
 * value of a plain object. Returns a new collection of the same shape with transformed values.
 *
 * - **Array input**: maps over elements; `undefined` results from the processor appear as `undefined` in output.
 * - **Object input**: maps over values; keys are always preserved in the output.
 * - **Non-collection input**: throws a `ConstraintError`.
 *
 * Note that `null` returned by the processor is the standard prune signal and will remove
 * the element/entry from the output.
 *
 * **Parameters**:
 * - `processor` (any valid processor spec, required): Applied to each element or value.
 *
 * **Input**: `[1, '2', 3]` with `{$map: '$number'}` → **Output**: `[1, 2, 3]`
 *
 * **Input**: `{a: 1, b: 2}` with `{$map: '$string'}` → **Output**: `{a: '1', b: '2'}`
 *
 * @type {ValueProcessorDefinition}
 */
export const MAP_OPERATOR = {
  keyword: 'map',
  parameters: [{parameter: 'processor', required: true}],
  build: (args) => {
    let processor;
    if (Array.isArray(args)) {
      if (args.length > 1) {
        throw new SchemaError('Expected exactly one argument for $map operator');
      }
      processor = args[0];
    }
    else if (typeof args === 'object') {
      if (Object.keys(args).length !== 1) {
        throw new SchemaError('Expected only "processor" argument for $map operator');
      }
      processor = args.processor;
    }
    processor ??= new FunctionValueProcessor(v => (v === undefined || v === null) ? undefined : v);

    return new ComposedValueProcessor(
      new EachExecutor(processor,
        (input) => {
          if (Array.isArray(input)) { return input }
          if (isPlainObject(input)) { return Object.values(input) }

          throw new ConstraintError(`$map requires an array or plain object, got ${formatValue(input)}`);
        },
        (output, input) => {
          if (Array.isArray(input)) { return output }
          if (isPlainObject(input)) {
            return Object.fromEntries(Object.keys(input).map((key, index) => ([key, output[index]])))
          }

        }
      ),
      {$map: processor.spec}
    )
  }
};
