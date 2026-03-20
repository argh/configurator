import { parse } from '../helpers/stringify.js';
import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$object`
 *
 * Attempts to normalize the input value as an object.
 *
 * See `$is-object` for strict object validation.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const OBJECT_OPERATOR = {
  keyword: 'object',
  process: (value) => {
    if (value === true) {
      value = {};
    }
    if (typeof value === 'string') {
      // otherwise, we normalize as an object
      try {
        value = parse(value);
      }
      catch (error) {
        throw new ConstraintError(`Invalid input string for object: ${formatValue(value)}`, {cause: error});
      }
    }
    if (Array.isArray(value) && value.every(e => Array.isArray(e) && e.length === 2)) {
      return Object.fromEntries(value);
    }
    if (typeof value === 'object') {
      return value;
    }
    throw new ConstraintError(`Invalid input for object: ${formatValue(value)}`);
  }
};
