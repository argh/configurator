import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$nonempty`
 *
 * Validates that a string, array, or object is not empty. For strings, the value must contain
 * at least one non-whitespace character. For arrays, the length must be greater than zero.
 * For objects, the number of keys must be greater than zero.
 *
 * **Valid values**: `"hello"`, `"  text  "`, `[1, 2, 3]`, `["item"]`, `{hello: "world"}`
 *
 * **Invalid values**: `""`, `"   "` (whitespace only), `[]`, `{}`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const NONEMPTY_CONSTRAINT = {
  keyword: 'nonempty',
  process: (value, _target, location) => {

    if (typeof value === 'string') {
      if (value.trim().length === 0) {
        throw new ConstraintError('String cannot be empty or whitespace only');
      }
    }
    else if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new ConstraintError('Array cannot be empty');
      }
    }
    else if (typeof value === 'object' && value !== null) {
      if (Object.keys(value).length === 0) {
        throw new ConstraintError('Object cannot be empty');
      }
    }
    else {
      if (value === undefined) {
        throw new ConstraintError('Value cannot be undefined');
      }
      else if (value === null) {
        throw new ConstraintError('Value cannot be null');
      }
    }
    return value;
  }
};
