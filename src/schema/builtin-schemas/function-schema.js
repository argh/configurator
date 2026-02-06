import { Schema } from '../schema.js';
import { deepValue } from '../../utils.js';
import { ConstraintError } from '../../errors.js';

export const FUNCTION_SCHEMA = new Schema()
  .option('type', 'function')
  .meta('parserTypeHint', 'string')
  .meta('hidden')
  .meta('internal')
  .meta('omitFromSerialize')
  .option('dynamic', false)
  .normalizer((value) => {
    if (typeof value === 'function' || typeof value === 'string') {
      return value;
    }
    throw new ConstraintError(`Invalid input for function: ${value}`)
  })
  .transformer((value, result) => {
    if (typeof value === 'string') {
      value = deepValue(result, value);  // look up the string as a reference in the current configuration
    }
    if (typeof value === 'function') {
      return value;
    }
    throw new ConstraintError(`Invalid function: ${value}`)
  })
  .validator(value => {
    if (typeof value === 'function') {
      return value;
    }
    throw new ConstraintError(`Invalid function: ${value}`);
  })
  .serializer((value) => {
    if (typeof value === 'function') {
      return value.name;
    }
    throw new ConstraintError(`Invalid function: ${value}`)
  })
