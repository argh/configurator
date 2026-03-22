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
 * **Examples**:
 * - `{a: {b: 1}}` with `{$get: {path: 'a.b'}}` → `1`
 * - `[10, 20, 30]` with `{$get: {path: 1}}` → `20`
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
