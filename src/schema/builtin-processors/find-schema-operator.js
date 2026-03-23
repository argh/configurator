import { formatValue } from "../../errors.js";
import { SchemaError } from '../schema-errors.js';

/**
 * ## $find-schema
 *
 * Find a schema in the schema hierarchy based on a dotted path.  Returns the current schema by default.
 * The provided path is interpreted relative to the currently active schema but supports navigation
 * to the root schema using '/' and parent schema using '^'.
 *
 * ### Parameters
 * - `path` (string | number, required): Dot-separated property path or array index.
 *
 * Example paths:
 * - '': The current schema.
 * - '/': The root schema.
 * - 'xyzzy': Find the 'xyzzy' child of the current schema.
 * - 'xyzzy.plugh': Find the 'plugh' child of the 'xyzzy' child of the current schema.
 * - 'child.^': The current schema if and only if the child exists.
 * - `/.foo.bar`: Find the 'bar' property in the 'foo' child of the root.
 * - `^`: Return the parent schema
 * - `^^jim`: Get the grandparent schema's child named 'jim' (uncle jim)
 * - `^.^.jim`: Same thing (extra dots are ignored.)
 *
 * ```js
 * new Schema('any').transformer({'$metadata': {name: 'description', schema: {'$find-schema': '^'}}})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const FIND_SCHEMA_OPERATOR = {
  keyword: 'find-schema',
  parameters: [{parameter: 'path', required: false}],

  process: (value, _target, location, options) => {
    /** @type {string} */
    const path = options.args?.path ?? value ?? '.';

    if (typeof path !== 'string') {
      throw new SchemaError(`$find-schema "path" must be a string, got ${formatValue(path)}`, {location});
    }

    return location.relative(path)?.schema;
  }
};
