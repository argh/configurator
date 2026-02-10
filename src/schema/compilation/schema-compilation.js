import { SchemaCompilationError, SchemaError } from '../../errors.js';
import { CompiledSchema } from '../compiled-schema.js';
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';

/**
 * Convert a schema to a simple object form compatible with the SchemaCompiler SchemaSchema assumptions
 *
 * @param {Schema|CompiledSchema} schema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {import("../types.js").SchemaData}
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

/**
 *
 * @param {Schema|CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {object} transformOptions
 * @returns {Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export async function transformSchema(inputSchema, _, location, transformOptions) {
  if (inputSchema instanceof CompiledSchema) {
    return inputSchema;
  }
  const cs = new CompiledSchema(CompiledSchema.__TOKEN);

  this.compileCache.set(transformOptions.traversalState.assignedInput, cs);

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

  const {values, ...options} = inputSchema.options;
  Object.assign(cs.options, options);
  const valueSet = new Set();
  for (const value of values ?? []) {
    const normalizedValue = await cs._normalizeValue(value);
    if (normalizedValue === undefined) {
      throw new SchemaCompilationError(`Undefined after normalizing`, {value, location});
    }
    valueSet.add(normalizedValue);
  }
  if (valueSet.size) {
    cs.options.values = [...valueSet];
  }

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

  if (schema.hasChildren && schema.options.type !== 'object' && schema.options.type !== 'array' && schema.options.type !== 'any') {
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
