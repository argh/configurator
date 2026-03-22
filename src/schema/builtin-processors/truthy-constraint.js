import { isTruthy } from '../../utils.js';
import { ConstraintError } from '../schema-errors.js';

/**
 * ## $truthy
 *
 * Validates that the value is "truthy".  Note that the definition of what values are "truthy"
 * mirrors the boolean schema normalization of special strings like "true" and "no".
 *
 * ### Example
 * ```js
 * // Require a feature flag to be truthy before processing a value
 * new Schema('object', {
 *   enabled: new Schema('boolean'),
 *   config: new Schema('string').validator({$assert: {$property: 'enabled'}}),
 * })
 *
 * // Use $truthy inside a conditional to branch on truthiness
 * new Schema('any').transformer({
 *   $if: ['$truthy', '$uppercase']
 * })
 * ```
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const TRUTHY_CONSTRAINT = {
  keyword: 'truthy',
  process: (value) => {
    if (isTruthy(value)) {
      return value;
    }
    throw new ConstraintError('Must be truthy');
  }
};

