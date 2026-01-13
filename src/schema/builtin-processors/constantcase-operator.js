import { toConstantCase } from '../../utils.js';

/**
 * **Processor**: `$constantcase`
 *
 * Converts a string to CONSTANT_CASE format (uppercase letters with underscores).
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$constantcase')
 *
 * // For configuration keys
 * Schema.create('object', {
 *   envVar: Schema.create('string').normalizer('$constantcase')
 * })
 *
 * // Combined with other processors
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$constantcase')
 * ```
 *
 * **Input**: `"Hello World"` → **Output**: `"HELLO_WORLD"`
 *
 * **Input**: `"myVariableName"` → **Output**: `"MY_VARIABLE_NAME"`
 *
 * **Input**: `"some-kebab-case"` → **Output**: `"SOME_KEBAB_CASE"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const CONSTANTCASE_OPERATOR = {
  keyword: 'constantcase',
  processor: (value) => {
    return toConstantCase(String(value));
  }
};
