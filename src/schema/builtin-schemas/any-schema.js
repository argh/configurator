import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';
import { hasStringProperties } from '../helpers/has-string-properties.js';

/**
 * @param {any} value
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {any}
 */
function anyValueProcessor(value, _, location) {
  const schema = location.schema;
  if (value === true && schema.hasChildren) {
    return hasStringProperties(schema)? {} : [];
  }
  return value;
}

export const ANY_SCHEMA = new Schema()
  .option('type', 'any')
  .normalizer(anyValueProcessor)
  .transformer(anyValueProcessor)
