import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$is-object`
 *
 * Validates that the input is a valid object (and not null!)
 *
 * See `$object` for looser object handling that accepts values that can be normalized as objects.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const IS_OBJECT_CONSTRAINT = {
  keyword: 'is-object',
  process: (value, _, location) => {
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    throw new ConstraintError('Must be an object');
  },
  description: ''
};
