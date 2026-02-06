import { CompiledSchema } from "../compiled-schema.js";
import { SchemaError } from '../../errors.js';
import { fpm } from './fpm.js';

/**
 * Check that the input object has appropriate container structure for the given path.
 *
 * Validates that:
 * - All parent segments in the path exist as containers (objects or arrays) in the input
 * - Optionally validates that the final path segment doesn't already exist
 *
 * @param {CompiledSchema} schema - a schema matching the provided path
 * @param {any} input - The input object to check
 * @param {string} path - The path relative to this schema (empty string for root)
 * @param {boolean} [allowExistingValue=false] - If false, throws if a value already exists at the final path
 * @returns {void}
 * @throws {SchemaError} If the structure is inconsistent
 */
export function checkConsistency(schema, input, path, allowExistingValue = false) {
  // Special case: undefined input at root path is always OK (creating from scratch)
  if (input === undefined && path === '') {
    return;
  }

  // Empty path means we're at the root
  if (path === '') {
    if (input !== undefined && !allowExistingValue) {
      throw new SchemaError('Value already exists at root path');
    }
    return;
  }

  // If we have a path but no input, that's an error
  if (input === undefined) {
    throw new SchemaError(`Cannot assign to path "${path}" with undefined input`);
  }

  // Validate that the path matches this schema's location
  const schemaSegments = schema.path ? schema.path.split('.').filter(s => s !== '') : [];
  const pathSegments = path ? path.split('.').filter(s => s !== '') : [];

  if (schemaSegments.length !== pathSegments.length) {
    throw new SchemaError(
      `Path depth mismatch: schema is at depth ${schemaSegments.length} ("${schema.path}"), ` +
      `but navigation path has depth ${pathSegments.length} ("${path}")`
    );
  }

  let checkSchema = schema.getRoot();

  // Verify each segment matches (accounting for wildcards)
  for (let i = 0; i < schemaSegments.length; i++) {
    const schemaSeg = schemaSegments[i];
    const pathSeg = pathSegments[i];

    if (schemaSeg !== '*' && schemaSeg !== pathSeg) {
      const schemaPathSoFar = schemaSegments.slice(0, i + 1).join('.');
      const navPathSoFar = pathSegments.slice(0, i + 1).join('.');

      checkSchema = checkSchema.getPropertySchema(pathSeg);

      if (!checkSchema) {
        throw new SchemaError(`Unable to find schema for ${navPathSoFar}`)
      }

      if (checkSchema.name !== schemaSeg) {
        throw new SchemaError(
          `Path mismatch at segment ${i}: schema path "${schemaPathSoFar}" ` +
          `does not match navigation path "${navPathSoFar}"`
        );
      }
    }
  }

  // Navigate through parent segments (all but the last)
  let current = input;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    const key = /^\d+$/.test(segment) ? Number(segment) : segment;
    const pathSoFar = pathSegments.slice(0, i + 1).join('.');

    current = current[key];

    if (current === undefined) {
      throw new SchemaError('Parent container does not exist', {path: pathSoFar});
    }

    if (current === null || (typeof current !== 'object' && !Array.isArray(current))) {
      throw new SchemaError('Parent path is not a container', {path: pathSoFar});
    }
  }

  // Check the final segment if allowExistingValue is false
  if (!allowExistingValue) {
    const finalSegment = pathSegments[pathSegments.length - 1];
    const finalKey = /^\d+$/.test(finalSegment) ? Number(finalSegment) : finalSegment;

    if (current[finalKey] !== undefined) {
      throw new SchemaError('Value already exists', {path}));
    }
  }
}
