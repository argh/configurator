import { Schema } from '../schema.js';
import { ConstraintError } from '../../errors.js';
import { parseDate } from '../helpers/parse-date.js';

export const DATE_SCHEMA = new Schema()
  .option('type', 'date')
  .meta('parserTypeHint', 'string')
  .meta('valueName', 'date')
  .meta('valueDescription', 'ms|iso date|"now"|[+|-]offset[d|h|m|s|ms]')
  .normalizer((value) => {
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date ) {
      return value;
    }
    throw new ConstraintError(`Invalid input for date: ${value}`);
  })
  .transformer(parseDate)
  .validator((value) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }
    throw new ConstraintError(`Invalid date: ${value}`)
  })
  .serializer((value) => {
    if (!(value instanceof Date)) {
      throw new ConstraintError(`Invalid date: ${value}`);
    }
    return value.toISOString();
  })
