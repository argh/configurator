import { Schema } from '../schema.js';

import { ConstraintError } from '../schema-errors.js';

export const BUFFER_SCHEMA = new Schema()
  .option('type', 'buffer')
  .meta('parserTypeHint', 'string')
  .normalizer(value => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    try {
      if (typeof value === 'string') {
        return Buffer.from(value,'base64');
      }
      if (typeof value === 'object' && Number.isInteger(value.size)) {
        return Buffer.alloc(value.size, value.fill ?? 0, value.encoding ?? 'utf8');
      }
      else if (typeof value === 'object' && value.encoding !== undefined) {
        return Buffer.from(value.buffer)
      }
      return Buffer.from(value);
    }
    catch (error) {
      throw new ConstraintError('Buffer array contains invalid data', {cause: error});
    }
  })
  .transformer((value) => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    try {
      // we prefer to already have a buffer, but allow anything we can easily convert
      if (typeof value === 'string') {
        return Buffer.from(value,'base64');
      }
      return Buffer.from(value);
    }
    catch (error) {
      throw new ConstraintError('Buffer array contains invalid data', {cause: error});
    }
  })
  .validator(value => {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    throw new ConstraintError(`Invalid buffer: ${value}`);
  })
  .serializer((value, _target, _location, options) => {
    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }
    if (options?.strict) {
      throw new ConstraintError(`Invalid buffer: ${value}`)
    }
    return undefined;
  })
