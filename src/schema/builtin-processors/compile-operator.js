import { SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { Executor } from '../executor/executor.js';
import { ValueProcessor } from '../value-processor/value-processor.js';
import { PipelineExecutor } from '../executor/pipeline-executor.js';

/**
 * ## $compile
 *
 * Compiles a `Schema` (or `CompiledSchema`) into a `CompiledSchema` ready for use
 * in value processing. If a schema argument is provided, that schema is compiled and
 * the input value is ignored. If no argument is given, the input value itself is treated
 * as the schema to compile — useful when a schema is being passed through as data.
 *
 * Typically used together with `$process` to dynamically select and apply a schema.
 *
 * ### Parameters
 * - `schema` (Schema|CompiledSchema, optional): The schema to compile. If omitted, the input
 *   value is compiled instead.
 *
 * ### Example
 * ```js
 * import { Schema } from '@versionzero/configurator';
 *
 * // Compile a fixed schema and feed it into $process
 * const portSchema = new Schema('number').validator({$range: {min: 1, max: 65535}});
 *
 * new Schema('object', {
 *   port: new Schema('any')
 *     .normalizer({$compile: portSchema})
 *     .transformer('$process'),
 * })
 *
 * // Compile the input value itself when schemas arrive as data
 * new Schema('any').transformer(['$compile', '$process'])
 * ```
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

