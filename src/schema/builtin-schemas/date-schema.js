import { Schema } from '../schema.js';

export const DATE_SCHEMA = new Schema()
  .option('type', 'date')
  .meta('parserTypeHint', 'string')
  .meta('valueName', 'date')
  .meta('valueDescription', 'ms|iso date|"now"|[+|-]offset[d|h|m|s|ms]')
  .normalizer('$date')
  .transformer('$date')
  .validator('$is-date')
  .serializer('$is-date')
  .serializer('$string')
