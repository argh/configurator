import { parse } from '../helpers/stringify.js';
import { ConstraintError } from '../schema-errors.js';

/**
 * **Processor**: `$array`
 *
 * Attempt to normalize the input value as an array.
 *
 * See `$is-array` for strict array validation.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const ARRAY_OPERATOR = {
  keyword: 'array',

  process: (value, _, location) => {
    if (value === true) {
      value = [];
    }
    else if (value === '*') {
      const values = location?.schema.getPropertySchema('*')?.values;
      if (values !== undefined) {
        value = [...values];
      }
      else {
        throw new ConstraintError('Schema must define values in order to expand wildcard array');
      }
    }
    if (typeof value === 'string') {
      value = value.trim();
      if (value.length > 0 && value[0] === '[' && value[value.length - 1] === ']') {
        try {
          value = parse(value);
        }
        catch (error) {
          throw new ConstraintError(`Invalid input string for array: ${value}`);
        }
      }
      else {
        value = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    if (Array.isArray(value)) {
      return value;
    }
    throw new ConstraintError(`Invalid input for array: ${value}`)
  }
};
