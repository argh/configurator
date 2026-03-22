/**
 * ## $join
 *
 * Join the input array elements into a string using the provided separator.
 *
 * ### Parameters
 * - `separator` (string, required): The value to use for joining
 *
 * If the input is not an array, it is treated as a single element.
 * Follows the behavior of JavaScript's Array.prototype.join()
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const JOIN_OPERATOR = {
  keyword: 'join',
  parameters: [ { parameter: 'separator', default: ',' } ],

  process: (value, _target, _location, options) => {
    const separator = options.args?.['separator'];

    if (!Array.isArray(value)) {
      return `${value}`;
    }
    return value.join(separator);
  }
}
