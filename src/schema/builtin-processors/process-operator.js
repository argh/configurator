import { CompiledSchema } from '../compiled-schema.js';
import { SchemaError } from "../schema-errors.js";
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$process`
 *
 * Process the incoming value according to the provided schema
 *
 * **Parameters**:
 * - `schema` (CompiledSchema, required): the schema to use for processing
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
