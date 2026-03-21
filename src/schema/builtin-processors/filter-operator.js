import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { EachExecutor } from '../executor/each-executor.js';
import { SchemaError } from '../schema-errors.js';

/**
 * **Processor**: `$filter`
 *
 * **Parameters**:
 * - `processor` (any valid processor spec, optional): The processor to apply to each element.
 *
 * Runs a processor on each element of the input array, keeping elements for which the processor
 * succeeds and returning the processor's output value (consistent with standard processor semantics).
 * Elements are filtered out if the processor throws or returns undefined.
 * (Note that processor results are not checked for truthiness — only for definedness.)
 *
 * Non-arrays are "filtered" as an empty array.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const FILTER_OPERATOR = {
  keyword: 'filter',
  parameters: [{parameter: 'processor', required: false}],
  build: (args) => {
    let processor;
    if (Array.isArray(args)) {
      if (args.length > 1) {
        throw new SchemaError('Expected exactly one argument for $filter operator');
      }
      processor = args[0];
    }
    else if (typeof args === 'object') {
      if (Object.keys(args).length !== 1) {
        throw new SchemaError('Expected only "processor" argument for $filter operator');
      }
      processor = args.processor;
    }
    processor ??= new FunctionValueProcessor(v => (v === undefined || v === null)? undefined : v);

    return new ComposedValueProcessor(
      new EachExecutor(
        new ConditionalExecutor(processor, {}, [ConditionalExecutor.CHECK_DEFINED, ConditionalExecutor.PASS_RESULT]),
        (inputs) => {
          if (!Array.isArray(inputs)) {
            return [];
          }
          return inputs;
        },
        (results) => (Array.isArray(results)? results.filter(r => r !== undefined) : [])
      ),
      {$filter: processor.spec});
  }
};
