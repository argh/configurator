import { Schema } from '../schema.js';

export const ARRAY_SCHEMA = new Schema()
  .option('type', 'array')
  .option('container', true)
  .normalizer('$array')
//  .transformer('$array')
  .validator('$is-array')
