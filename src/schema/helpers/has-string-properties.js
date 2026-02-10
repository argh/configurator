import { CompiledSchema } from "../compiled-schema.js";

const IMPLIES_ARRAY = /^[\d*]/
/**
 * @param {import("../types.js").ISchema} schema
 * @returns {boolean}
 */
export function hasStringProperties(schema) {

  const propertyEntries = (schema instanceof CompiledSchema)? schema.propertyEntries : Object.entries(schema.properties ?? {});

  for (const [k] of propertyEntries) {
    if (!IMPLIES_ARRAY.test(k)) {
      return true;
    }
  }

  const unionSchemaEntries = (schema instanceof CompiledSchema)? schema.unionSchemaEntries : Object.entries(schema.unionSchemas ?? {});

  for (const [_uk,us] of unionSchemaEntries) {
    if (hasStringProperties(us)) {
      return true;
    }
  }

  return false;
}



