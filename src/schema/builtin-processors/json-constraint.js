import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$json`
 *
 * Validates that a string contains valid JSON that can be parsed by `JSON.parse()`.
 * The processor does not modify the input - it only validates that the string is
 * syntactically correct JSON.
 *
 * **Valid values**: `'{"key": "value"}'`, `'[1, 2, 3]'`, `'"string"'`, `'123'`, `'true'`, `'null'`
 *
 * **Invalid values**: `'{key: value}'` (unquoted keys), `'undefined'`, `'{trailing: comma,}'`, `"{'single': 'quotes'}"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const JSON_CONSTRAINT = {
  keyword: 'json',
  process: (value) => {
    try {
      JSON.parse(value);
      return value;
    } catch {
      throw new ConstraintError('Invalid JSON format');
    }
  }
};
