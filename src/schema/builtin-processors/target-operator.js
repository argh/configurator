/**
 * ## $target
 *
 * Returns the target value passed to the processor (value being built relative to the root).
 * (Note: may return undefined or partial results, depending on the schema!)
 *
 * ### Example
 *
 * ```js
 * // Uses $target to provide an object for $get to access
 * new Schema('object')
 *   .property('level-one', new Schema('object')
 *     .property('enable-level-3', new Schema('boolean').default(false))
 *     .property('level-two', new Schema('object')
 *       .property('level-three', new Schema('object')
 *         .condition(['$target', {get: 'level-one.enable-level-3'}])
 *         .property('child', new Schema('string'))
 *       )
 *     )
 *   )
 * // { "level-one": { "level-two": { "level-three": { "child": "ignored" } } } }
 * // { "level-one": { "enable-level-3": true, "level-two": { "level-three": { "child": "is set" } } } }
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const TARGET_OPERATOR = {
  keyword: 'target',
  process: (_input, target) => target
};
