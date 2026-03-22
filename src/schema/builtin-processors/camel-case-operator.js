import { toCamelCase } from '../../utils.js';

/**
 * ## $camel-case
 *
 * Converts a string value to camelCase format. Words are identified by spaces,
 * hyphens, underscores, or case changes. The first letter is lowercased, and
 * subsequent words are capitalized with no separators.
 * Safe to use in normalize phase (non-throwing).
 *
 * **Input examples**:
 * - `"hello world"` → **Output**: `"helloWorld"`
 * - `"foo-bar-baz"` → **Output**: `"fooBarBaz"`
 * - `"user_name_id"` → **Output**: `"userNameId"`
 * - `"HTTPSConnection"` → **Output**: `"httpsConnection"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const CAMEL_CASE_OPERATOR = {
  keyword: 'camel-case',
  process: (value) => {
    return toCamelCase(String(value));
  }
};
