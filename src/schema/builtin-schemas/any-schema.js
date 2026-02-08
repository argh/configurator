import { CompiledSchema } from "../compiled-schema.js";
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';

const IMPLIES_ARRAY = /^[\d*]/
/**
 * @param {CompiledSchema} schema
 * @returns {boolean}
 */
function hasStringProps(schema) {
  for (const [k] of schema.propertyEntries) {
    if (!IMPLIES_ARRAY.test(k)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {any} value
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {Object} options
 */
function anyValueProcessor(value, _, location, options) {
  const schema = location.schema;
  if (value === true && schema.hasChildren) {
    const unionSchemas = Array.from(schema.unionSchemaEntries).map(e => e[1]);
    return [schema, ...unionSchemas].some(hasStringProps) ? {} : [];
  }
  return value;
}

export const ANY_SCHEMA = new Schema()
  .option('type', 'any')
  .normalizer(anyValueProcessor)
  .transformer(anyValueProcessor)
