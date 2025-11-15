import { Schema } from '../schema.js';

export const ROOT_SCHEMA = new Schema()
  .default(true)
  .meta('hidden')
  .meta('internal')
  .meta('omitFromSerialize')
  .normalizer(() => 'root-schema')
  .transformer((_v, _c, schema) => {
    while (schema?.parent) {
      schema = schema.parent;
    }
    return schema;
  })
  .serializer((_v, _c, schema) => {
    while (schema?.parent) {
      schema = schema.parent;
    }
    return schema.toData();
  })

