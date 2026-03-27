import { Schema } from '../schema.js';

export const OBJECT_SCHEMA = new Schema()
  .option('type', 'object')
  .option('container', true)
  .meta('valueName', 'object')
  .normalizer('$object')
//  .transformer('$object')
  .validator('$is-object')

