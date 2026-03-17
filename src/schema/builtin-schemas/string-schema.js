import { Schema } from '../schema.js';

export const STRING_SCHEMA = new Schema()
  .option('type', 'string')
  .meta('valueName', 'string')
  .normalizer('$string')
  .transformer('$string')
  .validator('$is-string')

