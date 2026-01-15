import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$defined`
 *
 * Allow any value, as long as it's defined.
 *
 * @example
 * ```javascript
 * // Basic usage
 * new Schema('object')
 *   .property('something', new Schema('any').validator('$defined'))
 *
 * (This would have a similar effect to "required")
 *
 * Can turn the result of $filter operator back into a constraint
 *
 * new Schema('object')
 *   .property('secret', new Schema('boolean').meta('hidden'))
 *   .property('danger', new Schema().validator({$pipeline: [{$reference: 'enableDanger', ]}}]
 *
 *
 * // Coerce environment variables to numbers
 * Schema.create('object', {
 *   port: Schema.create('string')
 *     .normalizer('$number')
 *     .validator({$range: {min: 1, max: 65535}})
 * })
 * ```
 *
 * **Valid values**: `"123"` → `123`, `"3.14"` → `3.14`, `"-42"` → `-42`, `0` → `0`, `42.5` → `42.5`
 *
 * **Invalid values**: `"abc"`, `"123abc"`, `""`, `null`, `undefined`, `NaN`, `Infinity`, `-Infinity`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const DEFINED_CONSTRAINT = {
  keyword: 'defined',
  processor: (value) => {
    if (value === undefined) {
      throw new ConstraintError('Must be defined');
    }
    return value;
  }
};
