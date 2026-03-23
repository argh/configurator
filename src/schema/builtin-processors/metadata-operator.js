import { SchemaError } from '../schema-errors.js';
import { CompiledSchema } from '../compiled-schema.js';
import { formatValue } from "../../errors.js";

/**
 * ## $metadata
 *
 * Extracts named metadata from a schema, either from the current schema or a parameter.
 *
 * Useful for getting standard metadata like `type` or `description`, or as a way to transport information
 * between schemas that get aggregated together.
 *
 * Returns `undefined` if the referenced schema or metadata key does not exist.
 *
 * ### Parameters
 * - `name` (string, required): The name of the metadata to extract from the schema.
 * - `schema` (Schema, optional): The schema to extract metadata from.  Defaults to the current schema.
 *
 * ### Example
 * ```js
 * // Here is an example that will simply propagate the current schema description
 * new Schema('object')
 *   .meta('description', 'This will be pulled into the property value')
 *   .property('description', new Schema('string').required().normalizer({$metadata: 'description'}))
 *
 * // In this case, we will extract the 'says' metadata from the 'pet' property schema after the union resolves
 * const catSchema = new Schema('string').meta('says', 'meow');
 * const dogSchema = new Schema('string').meta('says', 'woof');
 *
 * new Schema('object')
 *   .property('pet', new Schema('object')
 *     .property('type', new Schema('string').values(['cat', 'dog']))
 *     .unionSchema('cat', catSchema)
 *     .unionSchema('dog', dogSchema)
 *   )
 *   .property('say', new Schema('string').required()
 *     .normalizer({$metadata: {name: 'says', schema: '^.pet'}})
 *   )
 *
 * // Unlike most other "get a value" operators, $metadata does not use the pipeline input as the source
 * // because it is focused on the current processor calling context rather than values.  However, you can
 * // force it to use a compiled schema in the value pipeline by using $input:
 *
 * new Schema('string')
 *   .transformer(new Schema('string').meta('greeting', 'hello world'))
 *   .transformer({'$metadata': {name: 'greeting', schema: '$input'}})
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const METADATA_OPERATOR = {
  keyword: 'metadata',
  parameters: [{parameter: 'name', required: true}, {parameter: 'schema', required: false}],
  process: (_value, _target, location, options) => {

    const name = options.args.name;
    const schema = options.args.schema ?? location.schema;

    if (schema !== undefined && !(schema instanceof CompiledSchema)) {
      throw new SchemaError(`$metadata expects a valid schema, got ${formatValue(schema)}`, {location});
    }
    return schema?.metadata[`${name}`];
  }
};
