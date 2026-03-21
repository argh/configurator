/**
 * **Processor**: `$json-encode`
 *
 * Serializes any value to a JSON string.
 *
 * **Parameters**:
 * - `indent` (number, optional, default `0`): Indentation spaces for pretty-printing. `0` produces compact output.
 *
 * **Input**: `{a: 1, b: [2, 3]}` → **Output**: `'{"a":1,"b":[2,3]}'`
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
