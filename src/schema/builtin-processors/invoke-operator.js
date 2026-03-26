import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { Executor } from '../executor/executor.js';
import { PipelineExecutor } from '../executor/pipeline-executor.js';
import { ParameterizedValueProcessor } from '../value-processor/parameterized-value-processor.js';

/**
 * ## $invoke
 *
 * Calls a provided processor and passes it arguments (if any).
 *
 * ### Parameters
 * - `processor` (any valid processor spec, required): The processor to invoke.
 * - `arguments` (optional; any extra values to pass to the processor in `options.args`)
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const INVOKE_OPERATOR = {
  keyword: 'invoke',
  parameters: [{parameter: 'processor', required: true}, {parameter: 'arguments', required: false}],
  build: (args) => {
    const processor = (Array.isArray(args)? args[0] : args.processor);
    const wrapped = new ComposedValueProcessor(new PipelineExecutor([
      processor,
      v => v
    ]), processor.spec)
    const processorArguments = (Array.isArray(args)? args[1] : args['arguments']);

    return new ParameterizedValueProcessor(wrapped, processorArguments, {$invoke: {processor: processor?.spec, arguments: processorArguments?.spec}})
  }
};



