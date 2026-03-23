import { CompiledSchema } from '../compiled-schema.js';
import { SchemaError } from "../schema-errors.js";
import { formatValue } from '../../errors.js';

/**
 * ## $process
 *
 * Process the incoming value according to the provided schema
 *
 * ### Parameters
 * - `schema` (CompiledSchema, required): the compiled schema to apply to the input value.
 *   Any `Schema` found in a handler pipeline will be automatically compiled;
 *   Use `$compile` to produce a `CompiledSchema` from a `Schema` literal value.
 *
 * ### Example
 * ```js
 * import { Schema, SchemaResolver } from '@versionzero/configurator';
 *
 * // Compile a reusable sub-schema and run values through it
 * const resolver = new SchemaResolver();
 * const portSchema = await resolver.compile(
 *   new Schema('number').validator({$range: {min: 1, max: 65535}})
 * );
 *
 * // portSchema is automatically compiled:
 * new Schema('object', {
 *   port: new Schema('any').validator({$process: {schema: portSchema}}),
 * })
 *
 * // Use $compile inline to compile-then-process in a single pipeline
 * const mySchema = new Schema('string').validator('$non-empty');
 * new Schema('any').normalizer([{$compile: {$literal: mySchema}}, '$process'])
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const PROCESS_OPERATOR = {
  keyword: 'process',
  parameters: [ { parameter: 'schema', required: true } ],

  process: (value, _target, location, options) => {

    const schema = options.args.schema;

    if (!(schema instanceof CompiledSchema)) {
      throw new SchemaError(`Schema argument must be an instance of CompiledSchema, got ${formatValue(schema)})`, {location});
    }

    return schema.process(value); // do not pass options, or outer schema context/paths will leak in!
  }
};
