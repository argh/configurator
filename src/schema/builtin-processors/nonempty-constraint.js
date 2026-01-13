import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$nonempty`
 *
 * Validates that a string or array is not empty. For strings, the value must contain
 * at least one non-whitespace character. For arrays, the length must be greater than zero.
 *
 * @example
 * ```javascript
 * // Basic usage for strings
 * Schema.create('string').validator('$nonempty')
 *
 * // For arrays
 * Schema.create('array').validator('$nonempty')
 *
 * // In a schema property
 * Schema.create('object', {
 *   username: Schema.create('string').validator('$nonempty'),
 *   tags: Schema.create('array').validator('$nonempty')
 * })
 * ```
 *
 * **Valid values**: `"hello"`, `"  text  "`, `[1, 2, 3]`, `["item"]`
 *
 * **Invalid values**: `""`, `"   "` (whitespace only), `[]`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const NONEMPTY_CONSTRAINT = {
  keyword: 'nonempty',
  processor: (value) => {
    if (!(value && value.toString().trim().length > 0)) {
      throw new ConstraintError('Value cannot be empty');
    }
    return value;
  }
};
