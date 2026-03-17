import { isTruthy } from '../../utils.js';
import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$truthy`
 *
 * Validates that the value is "truthy".  Note that the definition of what values are "truthy"
 * mirrors the boolean schema normalization of special strings like "true" and "no".
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

