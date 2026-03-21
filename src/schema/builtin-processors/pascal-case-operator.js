import { toPascalCase } from '../../utils.js';

/**
 * **Processor**: `$pascal-case`
 *
 * Converts a string value to PascalCase format (first letter of each word capitalized, no separators).
 * Safe to use in normalize phase (non-throwing).
 *
 * **Input**: `"hello world"` → **Output**: `"HelloWorld"`
 *
 * **Input**: `"user-profile-page"` → **Output**: `"UserProfilePage"`
 *
 * **Input**: `"api_response_handler"` → **Output**: `"ApiResponseHandler"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const PASCAL_CASE_OPERATOR = {
  keyword: 'pascal-case',
  process: (value) => {
    return toPascalCase(String(value));
  }
};
