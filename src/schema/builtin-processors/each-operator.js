import { EachExecutor } from "../executor/each-executor.js";
import { ConstraintError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';

/**
 * **Processor**: `$each`
 *
 * Applies a processor to each element of an array. The processor can be any valid
 * processor specification (RegExp, function, keyword, or parameterized processor).
 * If any element fails validation, the entire array is rejected.
 *
 * This operator is useful for applying consistent validation or transformation rules
 * across all array elements without requiring explicit array element schemas.
 *
 * **Parameters**:
 * - `processor` (any valid processor spec, required): The processor to apply to each element.
 *   Can be a RegExp, function, string keyword (e.g., `'$numeric'`), or parameterized processor object.
 *
 * **Valid values**: Any array where all elements satisfy the specified processor
 *
 * **Invalid values**: Non-array values, or arrays where any element fails the processor
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const EACH_OPERATOR = {
  keyword: 'each',
  parameters: [{parameter: 'processor', required: true}],
  build: (args) => {
    const processor = Array.isArray(args)? args[0] : args.processor;

    const spec = {$each: processor.spec};
    const description = processor.description ? `[${processor.description}]...` : 'values...';

    return new ComposedValueProcessor(new EachExecutor(processor), spec, description);
  }
};



