import { Schema } from '../schema.js';
import { stringify } from '../helpers/stringify.js';
import { ConstraintError } from '../../errors.js';


export const STRING_SCHEMA = new Schema()
  .option('type', 'string')
  .meta('valueName', 'string')
  .normalizer((value) => {
    if (typeof value === 'object') {
      return stringify(value);
    }
    else {
      return String(value)
    }
  })
  .validator((value) => {
    if (typeof value === 'string') {
      return value;
    }
    throw new ConstraintError(`Invalid string: ${value}`);
  })

