import { SchemaError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';
import { ParametersValueProcessor } from '../value-processor/parameters-value-processor.js';
import { ParameterizedValueProcessor } from '../value-processor/parameterized-value-processor.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';

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
  parameters: [{parameter: 'schema', required: false}, {parameter: 'compiler', required: false}],
  build: (args, options) => {

    const compiler = options.compiler;

    const paramsProcessor = new ParametersValueProcessor(COMPILE_OPERATOR.parameters, args);

    return new ParameterizedValueProcessor(
      new FunctionValueProcessor((schema, _target, location, options) => {
        const c = options.args.compiler ?? compiler;
        if (typeof c?.compile !== 'function') {
          throw new SchemaError(`Invalid compiler provided to $compile ${formatValue(c)}`, {location})
        }
        if (options.args.schema !== undefined) {
          schema = options.args.schema;
        }
        return c.compile(schema)
      }),
      paramsProcessor,
      {$compile: paramsProcessor.spec}
    );
  }
};

