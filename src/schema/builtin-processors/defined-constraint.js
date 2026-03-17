import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$defined`
 *
 * Allow any value, as long as it's defined.
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
