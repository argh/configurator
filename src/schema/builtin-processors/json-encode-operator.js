/**
 * ## $json-encode
 *
 * Serializes any value to a JSON string.
 *
 * ### Parameters
 * - `indent` (number, optional, default `0`): Indentation spaces for pretty-printing. `0` produces compact output.
 *
 * ### Example
 * ```js
 * // Serialize an object to a compact JSON string
 * new Schema('object').transformer('$json-encode')
 * // {a: 1} → '{"a":1}'
 *
 * // Pretty-print with 2-space indentation
 * new Schema('object').transformer({'$json-encode': {indent: 2}})
 * // {a: 1} → '{\n  "a": 1\n}'
 *
 * // Encode a nested payload field for storage
 * new Schema('object', {
 *   payload: new Schema('object').transformer('$json-encode'),
 * })
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const JSON_ENCODE_OPERATOR = {
  keyword: 'json-encode',
  parameters: [ { parameter: 'indent', default: 0 } ],

  process: (value, _target, _location, options) => {
    const indent = options.args?.['indent'] || 0;
    return JSON.stringify(value, null, indent || undefined);
  }
};
