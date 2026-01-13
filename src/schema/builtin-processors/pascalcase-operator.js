import { toPascalCase } from '../../utils.js';

/**
 * **Processor**: `$pascalcase`
 *
 * Converts a string value to PascalCase format (first letter of each word capitalized, no separators).
 * Safe to use in normalize phase (non-throwing).
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').normalizer('$pascalcase')
 *
 * // Convert component names to PascalCase
 * Schema.create('object', {
 *   componentName: Schema.create('string').normalizer('$pascalcase')
 * })
 *
 * // Combined with other processors in a pipeline
 * Schema.create('string')
 *   .normalizer('$trim')
 *   .normalizer('$pascalcase')
 * ```
 *
 * **Input**: `"hello world"` → **Output**: `"HelloWorld"`
 *
 * **Input**: `"user-profile-page"` → **Output**: `"UserProfilePage"`
 *
 * **Input**: `"api_response_handler"` → **Output**: `"ApiResponseHandler"`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const PASCALCASE_OPERATOR = {
  keyword: 'pascalcase',
  processor: (value) => {
    return toPascalCase(String(value));
  }
};
