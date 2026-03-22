import { deepValue } from '../../utils.js';

/**
 * ## $get
 *
 * Extracts a value from the input using a dot-separated path (for objects) or a numeric
 * index (for arrays). Does not require the path to be declared as a schema property —
 * use `$property` when schema-awareness is needed.
 *
 * Returns `undefined` if the path does not resolve.
 *
 * ### Parameters
 * - `path` (string | number, required): Dot-separated property path or array index.
 *
 * ### Example
 * ```js
 * // Extract a nested property from an object
 * new Schema('object').transformer({$get: {path: 'database.host'}})
 * // {database: {host: 'localhost'}} → 'localhost'
 *
 * // Extract an array element by index
 * new Schema('array').transformer({$get: {path: 0}})
 * // ['first', 'second'] → 'first'
 *
 * // Use as a conditional predicate — only proceed if the path exists
 * new Schema('object').transformer({
 *   $when: [{$get: {path: 'config.timeout'}}]
 * })
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const GET_OPERATOR = {
  keyword: 'get',
  parameters: [{parameter: 'path', required: true}],

  process: (value, _target, _location, options) => {
    const path = options.args?.path;
    if (typeof path === 'number') {
      return Array.isArray(value) ? value[path] : undefined;
    }
    return deepValue(value, path);
  }
};
