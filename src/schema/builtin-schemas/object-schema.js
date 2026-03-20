import { Schema } from '../schema.js';

export const OBJECT_SCHEMA = new Schema()
  .option('type', 'object')
  .meta('valueName', 'object')
  .normalizer('$object')
//  .transformer('$object')
  .validator('$is-object')

