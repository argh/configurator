import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$json`
 *
 * Validates that a string contains valid JSON that can be parsed by `JSON.parse()`.
 * The processor does not modify the input - it only validates that the string is
 * syntactically correct JSON.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$json')
 *
 * // In a schema property for configuration strings
 * Schema.create('object', {
 *   metadata: Schema.create('string').validator('$json'),
 *   payload: Schema.create('string').validator('$json')
 * })
 * ```
 *
 * **Valid values**: `'{"key": "value"}'`, `'[1, 2, 3]'`, `'"string"'`, `'123'`, `'true'`, `'null'`
 *
 * **Invalid values**: `'{key: value}'` (unquoted keys), `'undefined'`, `'{trailing: comma,}'`, `"{'single': 'quotes'}"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const JSON_CONSTRAINT = {
  keyword: 'json',
  processor: (value) => {
    try {
      JSON.parse(value);
      return value;
    } catch {
      throw new ConstraintError('Invalid JSON format');
    }
  }
};
