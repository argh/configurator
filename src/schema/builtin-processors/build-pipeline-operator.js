import { ResolverError } from '../schema-errors.js';
import { PipelineExecutor } from '../executor/pipeline-executor.js';

import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { map } from '../../utils.js';

/**
 * @import {ValueProcessorDefinition} from '../value-processor/value-processor.js'
 */

/**
 * **Processor**: `$pipeline`
 *
 * Executes a sequence of processors in order, passing the output of each processor
 * as input to the next. The final processor's output becomes the result.
 *
 * **Note**: Handler arrays (normalizers, validators, etc.) implicitly create pipelines,
 * so this processor is rarely used directly. It's primarily used internally by the
 * schema compiler to aggregate handler arrays into single compiled processors.
 *
 * **Parameters**:
 * - `processors` (Array<ProcessorSpec>, required): Array of processor specifications to execute in sequence.
 *   Each element can be a string keyword (e.g., `'$trim'`), a parameterized processor object
 *   (e.g., `{$range: {min: 0}}`), a RegExp, or a function.
 *
 * **Behavior**: Processors execute left-to-right. If any processor throws an error, the pipeline
 * stops and the error propagates. Each processor receives the output of the previous processor
 * as its input value.
 *
 * @type {ValueProcessorDefinition}
 */
export const PIPELINE_OPERATOR = {
  keyword: 'pipeline',
  build: (args) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$pipeline requires an array of processors');
    }

    const descriptions = args.map(arg => arg.description ?? '').filter(Boolean);
    const description = descriptions.length > 1
                        ? descriptions.map(d => (d.includes('|') || d.includes('&')) ? `(${d})` : d).join(' >> ')
                        : descriptions[0]
    const spec = {$pipeline: map(args, arg => arg.spec)}

    return new ComposedValueProcessor(new PipelineExecutor(args), spec, description);
  }
}


