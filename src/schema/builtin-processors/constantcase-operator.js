import { toConstantCase } from '../../utils.js';

/**
 * **Processor**: `$constantcase`
 *
 * Converts a string to CONSTANT_CASE format (uppercase letters with underscores).
 * Safe to use in normalize phase (non-throwing).
 *
 * **Input**: `"Hello World"` → **Output**: `"HELLO_WORLD"`
 *
 * **Input**: `"myVariableName"` → **Output**: `"MY_VARIABLE_NAME"`
 *
 * **Input**: `"some-kebab-case"` → **Output**: `"SOME_KEBAB_CASE"`
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const CONSTANTCASE_OPERATOR = {
  keyword: 'constantcase',
  process: (value) => {
    return toConstantCase(String(value));
  }
};
