import { Schema } from '../schema.js';

export const BOOLEAN_SCHEMA = new Schema()
  .option('type', 'boolean')
  .meta('valueName', 'boolean')
  .validator({$in: [true, false]})
  .normalizer((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return Boolean(value);
  })
