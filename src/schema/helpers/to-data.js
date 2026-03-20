import { CompiledSchema } from '../compiled-schema.js';
import { Schema } from '../schema.js';

import { SchemaError } from '../schema-errors.js';
/** @import {SchemaData} from '../types.js' */
/**
 * Common implementation shared by both Schema and CompiledSchema
 * (which only share a "fake" jsdoc interface to define their shape)
 * @package
 * @param {Schema|CompiledSchema|SchemaData} schema
 * @param {WeakMap<object,object>} [seen] - cycle-detection map; shared across recursive calls
 * @returns {SchemaData}
 */
export function toData(schema, seen = new WeakMap()) {

  if (typeof schema !== 'object') {
    throw new SchemaError('Not a schema!')
  }

  if (seen.has(schema)) {
    return seen.get(schema);
  }

  /** @type {SchemaData} */
  const data = {};
  seen.set(schema, data);

  if (!(schema instanceof CompiledSchema) && schema.base) {
    data.base = schema.base;
  }
  // sloppy copy so that we can also load dumb data
  for (const group of ['properties', 'unionSchemas', 'metadata', 'options', 'handlers']) {
    if (!schema[group]) {
      continue;
    }

    for (const [key, value] of Object.entries(schema[group])) {
      if (data[group] === undefined) {
        data[group] = {};
      }
      const isSchema = (value instanceof Schema) || (value instanceof CompiledSchema);

      let v = value;
      if (isSchema) {
        v = toData(value, seen);
      }
      else if (group === 'handlers') {
        if (Array.isArray(value)) {
          v = value.map(p => {
            if (p === null) { return '$null' }
            if (p === undefined) { return '$undefined' }
            if (typeof p === 'object' && p.spec !== undefined) {
              return p.spec;
            }
            return p;
          });
        }
      }
      (data[group])[key] = v;
    }
  }
  return data;
}
