/**
 * **Processor**: `$url-encode`
 *
 * Percent-encodes a string for safe use as a URL component (query param value,
 * path segment, etc.). Encodes all characters except unreserved URI characters
 * (`A–Z a–z 0–9 - _ . !  ~ * ' ( )`).
 *
 * Use `{$url-encode: {full: true}}` to encode a complete URL instead of a
 * component — this preserves `://`, `/`, `?`, `&`, `=`, and other structural
 * characters rather than encoding them.
 *
 * Non-string inputs are coerced to string before encoding.
 *
 * **Parameters**:
 * - `full` (boolean, optional, default `false`): Use full-URL encoding (`encodeURI`) rather than component encoding (`encodeURIComponent`).
 *
 * **Input**: `"hello world/path"` → **Output**: `"hello%20world%2Fpath"`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const URL_ENCODE_OPERATOR = {
  keyword: 'url-encode',
  parameters: [ { parameter: 'full', default: false } ],

  process: (value, _target, _location, options) => {
    const full = options.args?.['full'] ?? false;
    return full ? encodeURI(`${value}`) : encodeURIComponent(`${value}`);
  }
};
