import { ConfiguratorError, SchemaError, UnionResolutionError, ValidationError } from "../../errors.js";
import { CompiledSchema } from "../compiled-schema.js";
import { fpm } from './fpm.js';


/** @typedef {Set<CompiledSchema>} SchemaSet */
/** @typedef {Map<string,SchemaSet>} DiscriminatorPropertyMap */

/**
 * @package
 * @param {Array<CompiledSchema>} schemas
 * @returns {DiscriminatorPropertyMap}
 */
export function findDiscriminatorProperties(schemas) {

  const discriminatorPropertyMap = new Map();
  for (const schema of schemas) {
    let found = false;
    for (const [property, propertySchema] of Object.entries(schema.properties)) {
      if (Array.isArray(propertySchema.options.values) && (propertySchema.options.values.length > 0)) {
        if (!discriminatorPropertyMap.has(property)) {
          discriminatorPropertyMap.set(property, new Set());
        }
        const schemaSet = discriminatorPropertyMap.get(property);
        schemaSet.add(schema);
        found = true;
      }
    }
    if (!found) {
      throw new ConfiguratorError('Schema needs at least one property with constrained values');
    }
  }

  // Augment list with unique properties
  const eliminated = new Set();
  const multiple = new Set();
  for (let i = 0; i < schemas.length; i++) {
    const schema1 = schemas[i];
    for (const property of Object.keys(schema1.properties)) {
      if (discriminatorPropertyMap.has(property) || multiple.has(property) || eliminated.has(property)) {
        continue;
      }
      const propertySchema = schema1.properties[property];
      if (propertySchema.options.default !== undefined) {
        eliminated.add(property);
        // a default would cause it to self-discriminate!
        continue;
      }
      let canDistinguish = true;
      for (let j = i + 1; j < schemas.length; j++) {
        const schema2 = schemas[j];
        if (schema2.properties[property]) {
          multiple.add(property)
          canDistinguish = false;
          break;
        }
      }
      if (canDistinguish) {
        discriminatorPropertyMap.set(property, new Set([schema1]))
      }
    }
  }
  for (const p of discriminatorPropertyMap.keys()) {
    if (eliminated.has(p)) {
      discriminatorPropertyMap.delete(p);
    }
  }
  // After the main loop, check if all schemas are distinguishable
  for (let i = 0; i < schemas.length; i++) {
    for (let j = i + 1; j < schemas.length; j++) {
      const schema1 = schemas[i];
      const schema2 = schemas[j];

      let canDistinguish = false;
      let uniqueProperty = true;

      for (const [property, schemaSet] of discriminatorPropertyMap) {
        // Check if both schemas have this discriminator property
        if (!schemaSet.has(schema1) || !schemaSet.has(schema2)) {
          continue;
        }
        uniqueProperty = false;

        const prop1 = schema1.properties[property];
        const prop2 = schema2.properties[property];

        const values1 = prop1.options.values ?? []; // should always be set, but fallback for typecheck nanny
        const values2 = prop2.options.values ?? [];

        // If the value sets are disjoint, we can distinguish them
        const hasOverlap = values1.some(v => values2.includes(v));
        if (!hasOverlap) {
          canDistinguish = true;
          break;
        }
      }

      if (!canDistinguish && !uniqueProperty) {
        throw new ConfiguratorError(
          `Union members are indistinguishable (cannot discriminate between schemas)`
        );
      }
    }
  }

  return discriminatorPropertyMap;
}

/**
 * @package
 * @param {CompiledSchema} schema
 * @returns {import("../types.js").AsyncSchemaValueProcessor<any>}
 */
export function generateAutomaticDiscriminatorFunction(schema) {
  if (!schema.isUnion) {
    throw new ConfiguratorError('Can only generate a discriminator for a union')
  }
  const unionSchemas = Object.values(schema.unionSchemas);
  const discriminatorProps = findDiscriminatorProperties(unionSchemas);

  /**
   * @param {any} inputObject
   * @param {any} configuration
   * @param {CompiledSchema} schema
   * @param {string} path
   * @param {Object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   */
  async function discriminator(inputObject, configuration, schema, path, options) {

    let candidates = new Set(Object.values(schema.unionSchemas))

    for (const [property, schemaSet] of discriminatorProps) {
      const propertyValue = inputObject?.[property];

      if (propertyValue === undefined) {
        continue;
      }

      if (schemaSet.size === 1) {
        const [single] = schemaSet;
        if (candidates.has(single)) {
          candidates = new Set([single])
        }
        else {
          candidates = new Set();
        }
      }
      for (const schema of schemaSet) {
        if (!candidates.has(schema)) {
          continue;
        }

        const propertySchema = schema.properties[property];
//        if (!propertySchema) {
//          continue;
//        }

        if (!await propertySchema?.accepts(propertyValue)) {
          candidates.delete(schema);

          if (candidates.size === 0) {
            throw new UnionResolutionError(fpm(`Union resolution conflict when setting ${property} to ${propertyValue}`, path));
          }
        }
      }
    }

    if (candidates.size === 1) {
      return Array.from(candidates)[0];
    }
    else if (candidates.size === 0) {
      throw new UnionResolutionError(fpm('Union resolution failure (no matches)', path));
    }
    else {
      if (options?.strict) {
        const keys = Array.from(candidates).map(s => schema.findUnionKey(s)).join('|')

        throw new UnionResolutionError(fpm(`Union resolution ambiguity (could be ${keys})`, path));
      }
      return undefined;
    }
  }

  return discriminator;
}

/**
 * @package
 * @param {CompiledSchema} schema
 * @param {string} propertyName
 * @returns {import("../types.js").AsyncSchemaValueProcessor<any>}
 */
export function generatePropertyValueDiscriminatorFunction(schema, propertyName) {

  const ref = schema.properties[propertyName];
  if (!ref) {
    throw new SchemaError(`Discriminator property ${propertyName} not found`);
  }

  /**
   * @param {any} input
   * @returns {Promise<CompiledSchema|string|undefined>}
   */
  async function discriminator(input) {
    return input?.[propertyName];
  }
  return discriminator;
}
