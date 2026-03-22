import { ConstraintError, SchemaError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';

/**
 * ## $replace
 *
 * Replaces occurrences of a pattern in a string.
 *
 * - Pattern may be a string (replaced globally via `replaceAll`) or a RegExp (flags control global).
 * - Replacement must be a string.
 *
 * ### Parameters
 * - First positional: pattern (string or RegExp, required)
 * - Second positional: replacement (string, required)
 *
 * ### Example
 * ```js
 * // Replace all underscores with hyphens
 * new Schema('string').transformer({$replace: ['_', '-']})
 * // 'hello_world' → 'hello-world'
 *
 * // Strip all non-digit characters using a RegExp
 * new Schema('string').normalizer({$replace: [/\D+/g, '']})
 * // '+1 (800) 555-1234' → '18005551234'
 *
 * // Redact sensitive patterns
 * new Schema('string').transformer({$replace: [/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, '[REDACTED]']})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const REPLACE_OPERATOR = {
  keyword: 'replace',

  build: (args) => {
    if (!Array.isArray(args) || args.length !== 2) {
      throw new SchemaError('$replace requires [pattern, replacement] arguments');
    }
    const pattern = args[0]?.spec;
    const replacement = args[1]?.spec;

    if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
      throw new SchemaError(`$replace pattern must be a string or RegExp, got ${formatValue(pattern)}`);
    }
    if (typeof replacement !== 'string') {
      throw new SchemaError(`$replace replacement must be a string, got ${formatValue(replacement)}`);
    }

    return new FunctionValueProcessor((value, _target, location) => {
      if (typeof value !== 'string') {
        throw new ConstraintError(`$replace requires a string input, got ${formatValue(value)}`, {location});
      }
      return typeof pattern === 'string'
        ? value.replaceAll(pattern, replacement)
        : value.replace(pattern, replacement);
    });
  }
};

/**
 * ## $substring
 *
 * Extracts a portion of a string by start index and optional length.
 *
 * ### Parameters
 * - `start` (number, required): Start index (0-based).
 * - `length` (number, optional): Number of characters to extract. If omitted, extracts to end of string.
 *
 * ### Example
 * ```js
 * // Extract the first 8 characters of a hash
 * new Schema('string').transformer({$substring: {start: 0, length: 8}})
 * // 'abcdef1234567890' → 'abcdef12'
 *
 * // Strip a known prefix (e.g. 'Bearer ')
 * new Schema('string').transformer({$substring: {start: 7}})
 *
 * // Extract a fixed-position field from a formatted string
 * new Schema('string').transformer({$substring: {start: 4, length: 2}})
 * // '2026-03-21' → '03' (month)
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const SUBSTRING_OPERATOR = {
  keyword: 'substring',
  parameters: [ { parameter: 'start', required: true }, { parameter: 'length' } ],

  process: (value, _target, location, options) => {
    if (typeof value !== 'string') {
      throw new ConstraintError(`$substring requires a string input, got ${formatValue(value)}`, {location});
    }
    const start = options.args['start'];
    const length = options.args['length'];
    return length !== undefined
      ? value.substring(start, start + length)
      : value.substring(start);
  }
};

/**
 * ## $pad
 *
 * Pads a string to a minimum width.
 *
 * ### Parameters
 * - `width` (number, required): Target minimum length.
 * - `char` (string, optional): Pad character. Defaults to `' '`.
 * - `side` (`'left'`|`'right'`, optional): Which side to pad. Defaults to `'left'`.
 *
 * ### Example
 * ```js
 * // Zero-pad a numeric string to 6 digits
 * new Schema('string').transformer({$pad: {width: 6, char: '0'}})
 * // '42' → '000042'
 *
 * // Right-pad a string to fill a fixed-width column
 * new Schema('string').transformer({$pad: {width: 20, side: 'right'}})
 * // 'Alice' → 'Alice               '
 *
 * // Pad a month/day to 2 digits
 * new Schema('number').transformer(['$string', {$pad: {width: 2, char: '0'}}])
 * // 3 → '03'
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const PAD_OPERATOR = {
  keyword: 'pad',
  parameters: [
    { parameter: 'width', required: true },
    { parameter: 'char', default: ' ' },
    { parameter: 'side', default: 'left' }
  ],

  process: (value, _target, location, options) => {
    if (typeof value !== 'string') {
      throw new ConstraintError(`$pad requires a string input, got ${formatValue(value)}`, {location});
    }
    const width = options.args['width'];
    const char = options.args['char'];
    const side = options.args['side'];
    return side === 'right'
      ? value.padEnd(width, char)
      : value.padStart(width, char);
  }
};
