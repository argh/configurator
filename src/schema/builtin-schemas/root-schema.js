import { Schema } from '../schema.js';

export const ROOT_SCHEMA = new Schema()
  .default(true)
  .meta('hidden')
  .meta('internal')
  .meta('omitFromSerialize')
  .normalizer(() => 'root-schema')
  .transformer((_v, _c, location) => {
    while (location?.parent) {
      location = location.parent;
    }
    return location?.schema;
  })
  .serializer((_v, _c, location) => {
    while (location?.parent) {
      location = location.parent;
    }
    return location?.schema.toData();
  })

