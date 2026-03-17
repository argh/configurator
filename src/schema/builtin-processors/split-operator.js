/**
 * **Processor**: `$split`
 *
 * Stringify the input and split on the provided separator, returning an array.
 *
 * **Parameters**:
 * - `separator` (string, optional, defaults to ","): The value to use for splitting
 * - `limit` (integer, optional): The maximum number of elements to return.
 *
 * Note that RegExp separators must be wrapped in a `$literal` to prevent evaluation as constraints.
 * Otherwise, follows the behavior of JavaScript's String.prototype.split.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const SPLIT_OPERATOR = {
  keyword: 'split',
  parameters: [ { parameter: 'separator', default: ',' }, { parameter: 'limit', default: undefined } ],

  process: (value, _target, _location, options) => {
    const separator = options.args?.['separator'];
    const limit = options.args?.['limit'];

    return `${value}`.split(separator, limit);
  }
}
