import { CompiledSchema } from '../compiled-schema.js';
import { Schema } from '../schema.js';
import { SchemaError } from '../../errors.js';
/** @import {SchemaData} from '../types.js' */
/**
 * Common implementation shared by both Schema and CompiledSchema
 * (which only share a "fake" jsdoc interface to define their shape)
 * @package
 * @param {Schema|CompiledSchema|SchemaData} schema
 * @returns {SchemaData}
 */
export function toData(schema) {

  if (typeof schema !== 'object') {
    throw new SchemaError('Not a schema!')
  }
  /** @type {SchemaData} */
  const data = {};
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
        v = value.toData();
      }
      else if (group === 'handlers') {
        if (Array.isArray(value)) {
          v = value.map(p => ((p.spec !== undefined)? p.spec : p));
        }
      }
      (data[group])[key] = v;
    }
  }
  return data;
}
