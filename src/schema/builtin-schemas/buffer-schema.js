import { Schema } from '../schema.js';

export const BUFFER_SCHEMA = new Schema()
  .option('type', 'buffer')
  .meta('valueName', 'buffer')
  .meta('parserTypeHint', 'string')
  .normalizer('$buffer')
  .transformer('$buffer')
  .validator('$is-buffer')
  .serializer('$base64-encode')
