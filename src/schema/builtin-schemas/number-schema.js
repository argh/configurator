import { Schema } from '../schema.js';

export const NUMBER_SCHEMA = new Schema()
  .option('type', 'number')
  .meta('valueName', 'number')
  .normalizer('$number')
  .transformer('$number')
  .validator('$is-number')

