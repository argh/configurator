import { ConstraintError } from '../schema-errors.js';

/**
 * ## $defined
 *
 * Allow any value, as long as it's defined.
 *
 * ### Example
 * ```js
 * // Ensure an optional field, when supplied, is not undefined
 * new Schema('any').validator('$defined')
 *
 * // Gate a sub-pipeline: only run if the value is defined
 * new Schema('any').normalizer({$gate: ['$defined', '$trim']})
 *
 * // Require a computed result to be defined
 * new Schema('string').validator({$require: {$get: {path: 'nested.key'}}})
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const DEFINED_CONSTRAINT = {
  keyword: 'defined',
  process: (value) => {
    if (value === undefined) {
      throw new ConstraintError('Must be defined');
    }
    return value;
  }
};
