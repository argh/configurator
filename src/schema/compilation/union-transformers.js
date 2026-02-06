import { CompiledSchema } from "../compiled-schema.js";
import {
  findDiscriminatorProperties,
  generateAutomaticDiscriminatorFunction,
  generatePropertyValueDiscriminatorFunction
} from '../helpers/union-helpers.js';
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { Schema } from '../schema.js';
import { SchemaCompilationError } from '../../errors.js';
import { deepEquals } from '../../utils.js';

/**
 * @param {CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {Object} options
 * @returns {Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export async function synthesizeAutoDiscrimination(inputSchema, _, location, options) {
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

  const discriminatorPropertyMap = findDiscriminatorProperties(Object.values(inputSchema.unionSchemas));

  for (const [property, schemaSet] of discriminatorPropertyMap) {
    if (inputSchema.properties[property]) {
      continue;
    }

    if (schemaSet.size === 1) {
      const [unionSchema] = schemaSet;
      const propertySchema = unionSchema.properties[property];
      if (propertySchema) {
        // this feels dangerous...
        inputSchema.properties[property] = propertySchema;
      }
      continue;
    }

    let base;
    const values = new Set();

    let normalizerCompatible = true;
    let firstNormalizers;

    for (const unionSchema of schemaSet) {
      const propertySchema = unionSchema.properties[property];
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

    inputSchema.properties[property] = await compiler.process(hoisted);
  }
  inputSchema.handlers.discriminators = [
    compiler.resolver.compileProcessorSpec(generateAutomaticDiscriminatorFunction(inputSchema))
  ];

  return inputSchema;
}

/**
 * @param {CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {Object} options
 * @returns {Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export async function synthesizeKeyDiscrimination(inputSchema, _, location, options) {
  if (!inputSchema.isUnion) {
    return inputSchema;
  }
  const unionKeyProperties = Object.entries(inputSchema.properties).filter(e => e[1].isUnionKey);

  if (unionKeyProperties.length === 0) {
    return inputSchema;
  }
  if (unionKeyProperties.length > 1) {
    throw new SchemaCompilationError(`Union schema has multiple properties marked as union keys: ${unionKeyProperties.map(p => p[0]).join(', ')}`, {location});
  }
  const unionKeyPropertyName = unionKeyProperties[0][0];
  const unionKeyPropertySchema = unionKeyProperties[0][1];
  const unionKeyPropertyLocation = location.relative(unionKeyPropertyName);

  const unionKeySet = new Set();  // it's possible that keys may normalize to the same value :-/
  for (const unionKey in inputSchema.unionSchemas) {
    unionKeySet.add(await unionKeyPropertySchema._normalizeValue(unionKey));
  }

  if (unionKeySet.size !== Object.values(inputSchema.unionSchemas).length) {
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
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {Object} options
 * @returns {Promise<CompiledSchema>}
 */
export async function copyUnionOptions(inputSchema, _, location, options) {
  if (!inputSchema.isUnion) {
    return inputSchema;
  }
  for (const unionSchema of Object.values(inputSchema.unionSchemas)) {
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


