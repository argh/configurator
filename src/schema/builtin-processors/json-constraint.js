import { ConstraintError } from '../schema-errors.js';

/**
 * ## $json
 *
 * Validates that a string contains valid JSON that can be parsed by `JSON.parse()`.
 * The processor does not modify the input - it only validates that the string is
 * syntactically correct JSON.
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
