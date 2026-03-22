/**
 * ## $split
 *
 * Stringify the input and split on the provided separator, returning an array.
 *
 * ### Parameters
 * - `separator` (string, optional, defaults to ","): The value to use for splitting
 * - `limit` (integer, optional): The maximum number of elements to return.
 *
 * Note that RegExp separators must be wrapped in a `$literal` to prevent evaluation as constraints.
 * Otherwise, follows the behavior of JavaScript's String.prototype.split.
 *
 * ### Example
 * ```js
 * // Split a comma-separated list into an array
 * new Schema('string').transformer('$split')
 * // 'a,b,c' → ['a', 'b', 'c']
 *
 * // Split on a custom separator
 * new Schema('string').transformer({$split: {separator: ':'}})
 * // 'host:port' → ['host', 'port']
 *
 * // Split then normalize each element
 * new Schema('string').normalizer([{$split: {separator: ','}}, {$each: '$trim'}])
 * // '  a , b , c  ' → ['a', 'b', 'c']
 *
 * // Split a PATH-style variable, limiting to 5 segments
 * new Schema('string').transformer({$split: {separator: '/', limit: 5}})
 * ```
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
