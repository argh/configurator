import { ConstraintError, SchemaError } from '../schema-errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';

/**
 * ## $matches
 *
 * Constraint that tests the string representation of the input against a RegExp.
 * Throws a `ConstraintError` if the input does not match. Returns the original value unchanged.
 *
 * This is the explicit constraint form; bare RegExp values in processor specs are no longer
 * treated as implicit constraints and must be wrapped with `$matches`.
 *
 * ### Parameters
 * - `pattern` (RegExp, required): The pattern to test against.
 *
 * ### Example
 * ```js
 * // Validate a semantic version string
 * new Schema('string').validator({$matches: /^\d+\.\d+\.\d+$/})
 *
 * // Validate a slug (lowercase letters, numbers, hyphens only)
 * new Schema('string').validator({$matches: /^[a-z0-9]+(?:-[a-z0-9]+)*$/})
 *
 * // Validate a hex color code
 * new Schema('object', {
 *   color: new Schema('string').validator({$matches: /^#[0-9a-fA-F]{6}$/}),
 * })
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MATCHES_CONSTRAINT = {
  keyword: 'matches',
  build: (args) => {
    const regex = (Array.isArray(args) ? args[0] : args)?.spec;
    if (!(regex instanceof RegExp)) {
      throw new SchemaError('$matches requires a RegExp argument');
    }
    const fn = new FunctionValueProcessor((value, _target, location) => {
      if (!regex.test(String(value))) {
        throw new ConstraintError(`Value does not match pattern ${regex}`, {location});
      }
      return value;
    });
    fn.description = `${regex}`;
    return new ComposedValueProcessor(fn, {$matches: regex});
  }
};
