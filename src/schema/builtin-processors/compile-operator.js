import { SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { Executor } from '../executor/executor.js';
import { ValueProcessor } from '../value-processor/value-processor.js';
import { PipelineExecutor } from '../executor/pipeline-executor.js';

/**
 * ## $compile
 *
 * Compiles an input or provided Schema into a CompiledSchema
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const COMPILE_OPERATOR = {
  keyword: 'compile',
  parameters: [{parameter: 'schema', required: false}],
  build: (args, options) => {

    const compiler = options.compiler;

    let schemaArgument;
    if (Array.isArray(args)) {
      if (args.length === 1) {
        schemaArgument = args[0];
      }
      else if (args.length === 0) {
        schemaArgument = new ComposedValueProcessor(new Executor(), []);
      }
      else {
        throw new SchemaError('$compile requires a single schema argument');
      }
    }
    else if (typeof args === 'object') {
      schemaArgument = args.schema;
    }

    if (!(schemaArgument instanceof ValueProcessor)) {
      throw new SchemaError('$compile requires a schema argument');
    }

    return new ComposedValueProcessor(
      new PipelineExecutor([schemaArgument, (schema) => compiler.compile(schema)]),
        {$compile: schemaArgument}
    );
  }
};

