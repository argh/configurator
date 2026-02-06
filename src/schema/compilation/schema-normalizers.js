import { SchemaCompilationError, SchemaError } from '../../errors.js';
import { CompiledSchema } from '../compiled-schema.js';
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';

/**
 * Convert a schema to a simple object form compatible with the SchemaCompiler SchemaSchema assumptions
 *
 * @param {Schema|CompiledSchema} schema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {Object}
 */
export function normalizeSchema(schema, _, location) {
  if (schema instanceof CompiledSchema) {
    return schema;
  }
  if (!(schema instanceof Schema)) {
    throw new SchemaCompilationError('Normalization input is not a schema', {location})
  }
  if (schema.base) {
    throw new SchemaCompilationError(`Cannot normalize schema with unresolved base`, {location, value: schema.base});
  }

  const data = {};

  // sloppy copy so that we can also load dumb data
  for (const group of ['properties', 'unionSchemas', 'metadata', 'options', 'handlers']) {
    if (!schema[group]) {
      continue;
    }

    for (const [key, value] of Object.entries(schema[group])) {
      if (value === undefined) {
        continue
      }
      if (data[group] === undefined) {
        data[group] = {};
      }
      (data[group])[key] = value;
    }
  }
  return data;

}