import { Schema } from '../schema.js';
import { ConstraintError } from '../../errors.js';

export const BUFFER_SCHEMA = new Schema()
  .option('type', 'buffer')
  .meta('parserTypeHint', 'string')
  .normalizer(value => {
    if (typeof value === 'string' || Buffer.isBuffer(value)) {
      return value;
    }
    if (typeof value === 'number') {
      return Buffer.alloc(value);
    }
    if (typeof value === 'object') {
      if (!value.size) {
        throw new ConstraintError(`Invalid input for buffer: ${value}`);
      }
      return Buffer.alloc(value.size ?? 0, value.fill, value.encoding);
    }
  })
  .transformer((value) => {
    try {
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }
      else {
        return Buffer.from(value);
      }
    }
    catch (error) {
      throw new ConstraintError(`Invalid buffer: ${value}`, {cause: error});
    }
  })
  .validator(value => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    throw new ConstraintError(`Invalid buffer: ${value}`);
  })
  .serializer((value) => {
    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }
    throw new ConstraintError(`Invalid buffer: ${value}`)
  })
