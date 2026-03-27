import { CompiledSchema } from '../compiled-schema.js';
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';
import { SchemaCompilationError, SchemaError } from '../schema-errors.js';

/**
 * Convert a schema to a simple object form compatible with the SchemaCompiler SchemaSchema assumptions
 *
 * @param {any} schema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {import("../types.js").SchemaData}
 * @this {SchemaCompiler}
 */
export function normalizeSchema(schema, _, location) {
  if (schema === true) {
    return {};
  }

  if (schema instanceof CompiledSchema) {
    return schema;
  }
  if (this.normalizeCache.has(schema)) {
    //return new CachedSchemaReference(schema);
    return this.normalizeCache.get(schema);
  }
  const data = {};
  this.normalizeCache.set(schema, data);

  schema = this.resolver.resolve(schema, false);

//  return toData(schema);

  // todo - Q: why are we not using schema.toData()?  A: because it's recursive, and has its own cache that behaves differently
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
      let v = value;
      if (group === 'handlers') {
        if (value === null) {
          v = '$null'
        }
      }
      (data[group])[key] = v;
    }
  }
  return data;

}

/**
 *
 * @param {Schema|CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {object} transformOptions
 * @returns {CompiledSchema}
 * @this {SchemaCompiler}
 */
export function transformSchema(inputSchema, _, location, transformOptions) {
  if (inputSchema instanceof CompiledSchema) {
    return inputSchema;
  }
  const cs = new CompiledSchema(CompiledSchema.__TOKEN);

  this.compileCache.set(transformOptions.state.assignedInput, cs);

  for (const [propertyName, propertySchema] of Object.entries(inputSchema.properties ?? {})) {
    if (propertySchema instanceof CompiledSchema) {
      cs._setPropertySchema(propertyName, propertySchema);
    }
    else {
      throw new SchemaCompilationError(`Failed to compile property "${propertyName}" schema`, {location});
    }
  }
  for (const [unionKey, unionSchema] of Object.entries(inputSchema.unionSchemas ?? {})) {
    if (unionSchema instanceof CompiledSchema) {
      cs._setUnionSchema(unionKey, unionSchema);
    }
    else {
      throw new SchemaCompilationError(`Failed to compile union "${unionKey}" schema `, {location});
    }
  }
  Object.assign(cs.handlers, inputSchema.handlers);
  Object.assign(cs.metadata, inputSchema.metadata);
  Object.assign(cs.options, inputSchema.options);  // options.values will get re-written later

  return cs;
}

/**
 * @param {CompiledSchema} schema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {CompiledSchema}
 * @this {SchemaCompiler}
 */
export function validateSchema(schema, _, location) {
  if (!(schema instanceof CompiledSchema)) {
    throw new SchemaCompilationError('Not a schema', {location});
  }

  if (schema.isUnion && !schema.handlers.discriminators) {
    throw new SchemaCompilationError(`No discriminator defined for union`, {location});
  }

  if (schema.hasChildren && (!schema.options.container || (schema.options.type !== 'object' && schema.options.type !== 'array' && schema.options.type !== 'any'))) {
    throw new SchemaCompilationError(`Schema defines child properties but does not identify as a container`, {location});
  }

  if (schema.isUnion && schema.hasWildcard) {
    throw new SchemaCompilationError(`Wildcard properties cannot be set on a union`, {location});
  }

  if (schema.hasChildSelector !== schema.hasChildSelection) {
    throw new SchemaCompilationError(`Inconsistently defined selector/selections in properties`, {location});
  }

  if (location.path === '') {
    if (schema.isSelector) {
      throw new SchemaCompilationError('The root schema cannot be a selector', {location});
    }
    if (schema.isSelection) {
      throw new SchemaCompilationError('The root schema cannot be a selection', {location});
    }
    if (schema.isUnionKey) {
      throw new SchemaCompilationError('The root schema cannot be a union key', {location});
    }
  }

  return schema;
}
