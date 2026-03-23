/**
 * ## $input
 *
 * Returns the input value passed to the processor.  Acts as a declarative "pass-through".
 * Useful for passing the input to processor arguments that don't normally use the input as a default,
 * or as a placeholder in array arguments.
 *
 * ### Example
 * ```js
 * //
 * new Schema('string')
 *   .transformer([['{', '$input', '}']])
 *   .transformer({'$join': ''})
 *
 * "hello" -> "{hello}"
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const INPUT_OPERATOR = {
  keyword: 'input',
  process: input => input
};
