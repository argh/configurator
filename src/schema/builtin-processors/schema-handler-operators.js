import { CompiledSchema } from '../compiled-schema.js';
import { SchemaError } from "../schema-errors.js";
import { formatValue } from '../../errors.js';

/**
 * ## $normalize
 *
 * Normalize the incoming value according using the provided schema
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
 * const resolver = new SchemaResolver();
 *
 * const  = await resolver.compile(
 *   new Schema('object')
 *     .property('collection', new Schema('array')
 *       .property('*', new Schema('string').normalizer('$trim').normalizer('$lowercase'))
 *     .property('chosen', new Schema('string').normalizer({$normalize: {'$find-schema': '^.collection.*'}})
 * );
 *
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const NORMALIZE_OPERATOR = {
  keyword: 'normalize',
  parameters: [ { parameter: 'schema', required: true }, { parameter: 'value', required: false } ],

  process: (value, target, location, options = {}) => {
    const schema = options.args.schema;

    if (!(schema instanceof CompiledSchema)) {
      throw new SchemaError(`Schema argument must be an instance of CompiledSchema, got ${formatValue(schema)})`, {location});
    }

    const cycleCheck = (options.cycleCheck ?? new Set());

    if (cycleCheck.has(location.schema)) {
      throw new SchemaError(`Cycle detected while processing $normalize`, {location, value});
    }
    cycleCheck.add(location.schema);

    const v = options.args.value ?? value;

    return schema._normalizeValue(v, target, undefined, {cycleCheck}); // do not pass options, or outer schema context/paths will leak in!
  }
};
