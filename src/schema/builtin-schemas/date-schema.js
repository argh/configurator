import { SerializeError } from "../schema-errors.js";
import { Schema } from '../schema.js';
import { formatValue } from '../../errors.js';

export const DATE_SCHEMA = new Schema()
  .option('type', 'date')
  .meta('parserTypeHint', 'string')
  .meta('valueName', 'date')
  .meta('valueDescription', 'ms|iso date|"now"|[+|-]offset[d|h|m|s|ms]')
  .normalizer('$date')
  .transformer('$date')
  .validator('$is-date')
  .serializer((value, _target, _location, options) => {
    if (!(value instanceof Date)) {
      if (options?.strict) {
        throw new SerializeError(`Cannot serialize ${formatValue(value)} as a date`)
      }
      return undefined;
    }
    return value.toISOString();
  })
