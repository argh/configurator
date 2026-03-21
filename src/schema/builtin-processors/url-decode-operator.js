import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$url-decode`
 *
 * Decodes a percent-encoded URL string.
 *
 * Use `{$url-decode: {full: true}}` to decode a complete URL (`decodeURI`)
 * rather than a component (`decodeURIComponent`). Full-URL decoding preserves
 * sequences that are valid structural URL characters (`%2F` etc.) undecoded.
 *
 * Throws if the input is not a string or contains a malformed escape sequence.
 *
 * **Parameters**:
 * - `full` (boolean, optional, default `false`): Use full-URL decoding (`decodeURI`) rather than component decoding (`decodeURIComponent`).
 *
 * **Input**: `"hello%20world%2Fpath"` → **Output**: `"hello world/path"`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const URL_DECODE_OPERATOR = {
  keyword: 'url-decode',
  parameters: [ { parameter: 'full', default: false } ],

  process: (value, _target, location, options) => {
    if (typeof value !== 'string') {
      throw new ConstraintError(`$url-decode requires a string, got ${formatValue(value)}`, {location});
    }
    const full = options.args?.['full'] ?? false;
    try {
      return full ? decodeURI(value) : decodeURIComponent(value);
    }
    catch (error) {
      throw new ConstraintError(`$url-decode: malformed URI sequence — ${error.message}`, {location, cause: error});
    }
  }
};
