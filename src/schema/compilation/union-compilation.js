import { CompiledSchema } from "../compiled-schema.js";
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';
import { ConfiguratorError, SchemaCompilationError, SchemaError, UnionResolutionError } from '../../errors.js';
import { deepEquals } from '../../utils.js';

/**
 * @param {CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export async function synthesizeKeyDiscrimination(inputSchema, _, location) {
  if (!inputSchema.isUnion) {
    return inputSchema;
  }
  const unionKeyProperties = Array.from(inputSchema.propertyEntries).filter(e => e[1].isUnionKey);

  if (unionKeyProperties.length === 0) {
    return inputSchema;
  }
  if (unionKeyProperties.length > 1) {
    throw new SchemaCompilationError(`Union schema has multiple properties marked as union keys: ${unionKeyProperties.map(p => p[0]).join(', ')}`, {location});
  }
  const unionKeyPropertyName = unionKeyProperties[0][0];
  const unionKeyPropertySchema = unionKeyProperties[0][1];
  const unionKeyPropertyLocation = location.relative(unionKeyPropertyName);

  const unionSchemaEntries = [...inputSchema.unionSchemaEntries];

  const unionKeySet = new Set();  // it's possible that keys may normalize to the same value :-/
  for (const [unionKey] of unionSchemaEntries) {
    unionKeySet.add(await unionKeyPropertySchema._normalizeValue(unionKey));
  }

  if (unionKeySet.size !== unionSchemaEntries.length) {
    throw new SchemaCompilationError('Union keys must not collide after normalization with the unionKey property schema', {location});
  }

  const v = (unionKeyPropertySchema.values ?? []).sort();
  const uksv = [...unionKeySet].sort();

  if (v.length > 0) {
    if (!deepEquals(v, uksv)) {
      throw new SchemaCompilationError(
        `Union key schema values {${v.join('|')}} do not include all possible union keys {${uksv.join('|')}}`,
        {location: unionKeyPropertyLocation});
    }
  }
  else {
    if (unionKeyPropertySchema.isSelector) {
      throw new SchemaCompilationError(
        'Cannot populate values for a schema that is both a selector and a union key', {location: unionKeyPropertyLocation}
      );
    }
    unionKeyPropertySchema.options.values = uksv;
  }

  if (Array.isArray(inputSchema.handlers.discriminators) && inputSchema.handlers.discriminators.length > 0) {
    return inputSchema;
  }

  const compiler = this;

  // Note: it's ok to use a custom discriminator (above) even if there is a union key option,
  // as it also triggers population of allowed values for the property in _finalizeValues.
  inputSchema.handlers.discriminators = [
    compiler.resolver.compileProcessorSpec(
      generatePropertyValueDiscriminatorFunction(inputSchema, unionKeyPropertyName))
  ];
  return inputSchema;
}

/**
 * @param {CompiledSchema} inputSchema
 * @returns {Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export async function synthesizeAutoDiscrimination(inputSchema) {
  if (!inputSchema.isUnion) {
    return inputSchema;
  }

  if (Array.isArray(inputSchema.handlers.discriminators) && inputSchema.handlers.discriminators.length > 0) {
    return inputSchema;
  }

  if (inputSchema.hasValues) {
    return inputSchema;
  }

  // the compiler is bound to the helper functions
  const compiler = this;

  const discriminatorPropertyMap = findDiscriminatorProperties(inputSchema);

  for (const [property, schemaSet] of discriminatorPropertyMap) {
    if (inputSchema.getPropertySchema(property)) {
      continue;
    }

    if (schemaSet.size === 1) {
      const [unionSchema] = schemaSet;
      const propertySchema = unionSchema.getPropertySchema(property);
      if (propertySchema) {
        // this feels dangerous...
        inputSchema._setPropertySchema(property, propertySchema);
      }
      continue;
    }

    let base;
    const values = new Set();

    let normalizerCompatible = true;
    let firstNormalizers;

    for (const unionSchema of schemaSet) {
      const propertySchema = unionSchema.getPropertySchema(property);
      if (!propertySchema) {
        continue;
      }
      if (!firstNormalizers) {
        firstNormalizers = propertySchema.handlers.normalizers;
      }
      if (propertySchema.metadata.parserTypeHint) {
        if (base === undefined) {
          base = propertySchema.metadata.parserTypeHint;
        }
        else if (base && base !== propertySchema.metadata.parserTypeHint) {
          base = 'any';
          normalizerCompatible = false;
        }
      }
      if (!propertySchema.hasValues) {
        continue;
      }
      for (const v of propertySchema.values ?? []) {
        const normalized = await propertySchema._normalizeValue(v);
        if (normalizerCompatible && normalized !== v) {
          normalizerCompatible = false;
        }
        values.add(normalized);
        if (base === undefined) {
          if (compiler.resolver.hasSchema(typeof v)) {
            base = typeof v;
          }
        }
      }
    }

    const useNormalizer = normalizerCompatible && firstNormalizers;

    // TODO - Now that we support reusing schema instances throughout the hierarchy, is there a way
    //        that we can detect "basically identical schemas differing only in constrained values"?
    //        It feels like it would be far safer to check "is the schema the same" rather than
    //        "probe the schema's normalizers to see if they are compatible".

    const hoisted = new Schema(base ?? 'any');
    if (useNormalizer && firstNormalizers) {
      for (const normalizer of firstNormalizers) {
        hoisted.normalizer(normalizer);
      }
    }
    if (values.size > 0) {
      hoisted.values(Array.from(values))
    }

    inputSchema._setPropertySchema(property, await compiler.process(hoisted));
  }
  inputSchema.handlers.discriminators = [
    compiler.resolver.compileProcessorSpec(generateAutomaticDiscriminatorFunction(inputSchema))
  ];

  return inputSchema;
}


/**
 * @param {CompiledSchema} inputSchema
 * @returns {Promise<CompiledSchema>}
 */
export async function copyUnionOptions(inputSchema) {
  if (!inputSchema.isUnion) {
    return inputSchema;
  }
  for (const [unionSchemaKey, unionSchema] of inputSchema.unionSchemaEntries) {
    const skipOptions = ['values', 'type', 'default'];

    for (const [optionName, optionValue] of Object.entries(inputSchema.options ?? {})) {
      if (skipOptions.includes(optionName)) {
        continue;
      }
      // todo - detect if a union schema is a shared instance!
      //
      // If the union schema was separately compiled, this will throw a TypeError because it is frozen.

      if (optionValue !== undefined && unionSchema.options[optionName] === undefined) {
        // union schemas "inherit" options from their parent
        unionSchema.options[optionName] = optionValue;
      }
    }
  }
  return inputSchema;
}



/** @typedef {Set<CompiledSchema>} SchemaSet */
/** @typedef {Map<string,SchemaSet>} DiscriminatorPropertyMap */

/**
 * @package
 * @param {CompiledSchema} schema
 * @returns {DiscriminatorPropertyMap}
 */
function findDiscriminatorProperties(schema) {

  const schemas = Array.from(schema.unionSchemaEntries).map(e => e[1]);

  const discriminatorPropertyMap = new Map();
  for (const schema of schemas) {
    let found = false;
    for (const [property, propertySchema] of schema.propertyEntries) {
      if (Array.isArray(propertySchema.values) && (propertySchema.values.length > 0)) {
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
    for (const [property, propertySchema] of schema1.propertyEntries) {
      if (discriminatorPropertyMap.has(property) || multiple.has(property) || eliminated.has(property)) {
        continue;
      }
      if (propertySchema.default !== undefined) {
        eliminated.add(property);
        // a default would cause it to self-discriminate!
        continue;
      }
      let canDistinguish = true;
      for (let j = i + 1; j < schemas.length; j++) {
        const schema2 = schemas[j];
        if (schema2.getPropertySchema(property)) {
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

        const prop1 = schema1.getPropertySchema(property);
        const prop2 = schema2.getPropertySchema(property);

        const values1 = prop1?.values ?? []; // should always be set, but fallback for typecheck nanny
        const values2 = prop2?.values ?? [];

        // TODO - consider...?
        //const otherOverlap = values1.some(v => prop2.accepts(v));

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
function generateAutomaticDiscriminatorFunction(schema) {
  if (!schema.isUnion) {
    throw new ConfiguratorError('Can only generate a discriminator for a union')
  }
  const unionSchemas = Array.from(schema.unionSchemaEntries).map(e => e[1]);
  const discriminatorProps = findDiscriminatorProperties(schema);

  /**
   * @param {any} inputObject
   * @param {any} configuration
   * @param {SchemaLocation} location
   * @param {object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   */
  async function discriminator(inputObject, configuration, location, options) {

    let candidates = new Set(unionSchemas)
    let matched = false;

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
        const propertyLocation = location.union(schema)?.relative(property);

        if (propertyLocation === undefined) {
          // should never happen!
          continue;
        }

//        const propertySchema = schema.properties[property];
//        if (!propertySchema) {
//          continue;
//        }

        if (await propertyLocation.schema.accepts(propertyValue, configuration, propertyLocation,
          {...options, strict: false})) {
          matched = true;
        }
        else {
          candidates.delete(schema);

          if (candidates.size === 0) {
            throw new UnionResolutionError(`Union resolution conflict when setting ${property} to ${propertyValue}`,
              {location});
          }
        }
      }
    }

    if (candidates.size === 1) {
      if (!matched) {
        // didn't actually match, just accidentally ended up here (only one option?)
        if (options?.strict) {
          throw new UnionResolutionError('Union resolution failure (no matches)', {location});
        }
        return undefined;
      }
      return Array.from(candidates)[0];
    }
    else if (candidates.size === 0) {
      throw new UnionResolutionError('Union resolution failure (no matches)', {location});
    }
    else {
      if (options?.strict) {
        const keys = Array.from(candidates).map(s => schema.findUnionKey(s)).join('|')

        throw new UnionResolutionError(`Union resolution ambiguity (could be ${keys})`, {location});
      }
      return undefined;
    }
  }

  return discriminator;
}


/**
 * @param {CompiledSchema} schema
 * @param {string} propertyName
 * @returns {import("../types.js").AsyncSchemaValueProcessor<any>}
 */
function generatePropertyValueDiscriminatorFunction(schema, propertyName) {

  const ref = schema.getPropertySchema(propertyName);
  if (!ref) {
    throw new SchemaError(`Discriminator property ${propertyName} not found`);
  }

  /**
   * @param {any} input
   * @param {any} target
   * @param {SchemaLocation} location
   * @returns {Promise<CompiledSchema|string|undefined>}
   */
  async function discriminator(input, target, location) {
    // we could just look at location, but the union knows its own properties
    return input?.[propertyName];
  }

  return discriminator;
}


