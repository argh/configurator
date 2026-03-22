import { ConstraintError, SchemaError } from '../schema-errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';

/**
 * ## $match
 *
 * Operator that executes a RegExp match against a string input and returns the extracted result.
 * Non-string values are passed through unchanged. Returns `undefined` if the string does not match.
 *
 * - If the RegExp contains named capture groups (`(?<name>...)`), returns the `groups`
 *   object (ES2018 named captures) as a plain object.
 * - Otherwise, returns a plain array of the full match and positional capture groups.
 *
 * ### Parameters
 * - `pattern` (RegExp, required): The pattern to match against.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MATCH_OPERATOR = {
  keyword: 'match',
  build: (args) => {
    const regex = (Array.isArray(args) ? args[0] : args)?.spec;
    if (!(regex instanceof RegExp)) {
      throw new SchemaError('$match requires a RegExp argument');
    }
    return new ComposedValueProcessor(
      new FunctionValueProcessor((value, _target, location) => {
        if (typeof value !== 'string') {
          throw new ConstraintError('$match requires a string input', {location});
        }
        const result = value.match(regex);
        if (result === null) return undefined;
        if (result.groups && Object.keys(result.groups).length > 0) return {...result.groups};
        return [...result];
      }),
      {$match: regex},
      `${regex}`
    );
  }
};
