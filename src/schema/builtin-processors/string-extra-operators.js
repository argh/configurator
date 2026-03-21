import { ConstraintError, SchemaError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';

/**
 * **Processor**: `$replace`
 *
 * Replaces occurrences of a pattern in a string.
 *
 * - Pattern may be a string (replaced globally via `replaceAll`) or a RegExp (flags control global).
 * - Replacement must be a string.
 *
 * **Parameters**:
 * - First positional: pattern (string or RegExp, required)
 * - Second positional: replacement (string, required)
 *
 * **Input**: `'foo bar foo'` with `{$replace: ['foo', 'baz']}` → **Output**: `'baz bar baz'`
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
 * **Processor**: `$substring`
 *
 * Extracts a portion of a string by start index and optional length.
 *
 * **Parameters**:
 * - `start` (number, required): Start index (0-based).
 * - `length` (number, optional): Number of characters to extract. If omitted, extracts to end of string.
 *
 * **Input**: `'hello world'` with `{$substring: 6}` → **Output**: `'world'`
 * **Input**: `'hello world'` with `{$substring: {start: 0, length: 5}}` → **Output**: `'hello'`
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
 * **Processor**: `$pad`
 *
 * Pads a string to a minimum width.
 *
 * **Parameters**:
 * - `width` (number, required): Target minimum length.
 * - `char` (string, optional): Pad character. Defaults to `' '`.
 * - `side` (`'left'`|`'right'`, optional): Which side to pad. Defaults to `'left'`.
 *
 * **Input**: `'42'` with `{$pad: {width: 5}}` → **Output**: `'   42'`
 * **Input**: `'hi'` with `{$pad: {width: 5, char: '-', side: 'right'}}` → **Output**: `'hi---'`
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
