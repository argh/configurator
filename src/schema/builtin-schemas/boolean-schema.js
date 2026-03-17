import { Schema } from '../schema.js';
import { isTruthy } from '../../utils.js';

export const BOOLEAN_SCHEMA = new Schema()
  .option('type', 'boolean')
  .meta('valueName', 'boolean')
  .normalizer(isTruthy)
  .transformer(isTruthy)
  .validator({$in: [true, false]})


