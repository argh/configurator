import { CompiledSchema } from './compiled-schema.js';
import { SchemaResolver } from './schema-resolver.js';
import { Schema } from './schema.js';
import { NormalizeError, SchemaCompilationError, SchemaError, TransformError } from '../errors.js';
import { deepValue } from '../utils.js';
import { stringify } from './helpers/stringify.js';
import {
  copyUnionOptions, synthesizeKeyDiscrimination, synthesizeAutoDiscrimination,
} from './compilation/union-transformers.js';
import { SchemaLocation } from "./schema-location.js";
import { populateChildSelectorValues } from './compilation/selection-transformers.js';
import { formatArgumentType } from './helpers/format.js';
import { populateMetadata } from './compilation/metadata-transformers.js';
import { normalizeSchema } from './compilation/schema-normalizers.js';

/** @typedef {(inputSchema:CompiledSchema|Schema, targetSchema:CompiledSchema, location:SchemaLocation, options?:Object) => Promise<Schema|CompiledSchema|import("./types.js").SchemaData|undefined>} InputSchemaProcessor */
/** @typedef {(inputSchema:CompiledSchema, targetSchema:CompiledSchema, location:SchemaLocation, options?:Object) => Promise<CompiledSchema|undefined>} OutputSchemaProcessor */
/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaProperties */
/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaUnionSchemas */


// TODO - idea: broaden the concept of discriminators to "schemaResolvers" that can produce any replacement schema on demand.
//        then, make circular schema references be a dynamic resolver concept?

/**
 * Top-level "Schema Schema" - takes a Schema as input, emits a CompiledSchema as output
 */
export class SchemaCompiler extends CompiledSchema {
  /**
   * @param {SchemaResolver} resolver
   */
  constructor(resolver) {
    super(CompiledSchema.__TOKEN);

    this.resolver = resolver;

    this.compileSeen = new Set();
    this.compileCache = new Map();

    // We'll use Schema's fluent setters to carefully define a "Schema Schema", and then extract its guts.

    const processorListSchema = new Schema('array')
      .property('*', new Schema('any')
        .option('type', '__compilerSpec')
        .option('dynamic', false)
        .transformer(async (spec) => {
          return resolver.compileProcessorSpec(spec);
        })
        .opaque()
      )

    const schemaCompilerSchema = new Schema()
      .unionDiscriminator((s, _, location, options) => {
        if (this.compileSeen.has(s)) {
          return 'cache';
        }
        else if (s instanceof CompiledSchema) {
          return 'reference';
        }
        else if (typeof s === 'object') {
          this.compileSeen.add(s);
          return 'schema';
        }
        else {
          return undefined;
        }
      })

      .unionSchema('reference', new Schema()
        .required()
        .normalizer(s => {
          if (!(s instanceof CompiledSchema)) {
            throw new SchemaCompilationError('Not a CompiledSchema reference!');
          }
          return s;
        })
      )
      .unionSchema('cache', new Schema()
        .required()
        .normalizer(s => {
          if (!(s instanceof Schema)) {
            throw new SchemaCompilationError('Can only cache references to schemas')
          }
          return s;
        })
      )

    // The schema needs to be opaque right now because it contains internals that have a complex
    // resolution dependency chain that cannot (yet) be expressed in the schema itself:
    //
    // values depends on normalizers
    // discriminators is a default, but depends on checking values
    // selector and selection depend on condition and values
    //
    // validation depends on everything being configured properly as it checks options/children

    const schemaSchema = new Schema('object')
//      .option('type', 'object')
      .opaque()
      .normalizer(
        /** @type {InputSchemaProcessor} */ async (inputSchema) => {
          if (inputSchema instanceof CompiledSchema) {
            return inputSchema;
          }
          else if (typeof inputSchema === 'object') {
            return resolver.resolve(inputSchema, false);
          }
          else {
            throw new SchemaError('not a schema');
          }
        }
      )
      .normalizer(normalizeSchema)
      .transformer(
        /** @type {InputSchemaProcessor} */ (async (inputSchema, _, location, o) => {
          if (inputSchema instanceof CompiledSchema) {
            return inputSchema;
          }
          const cs = CS();
          this.compileCache.set(o.traversalState.assignedInput, cs);

          Object.assign(cs.properties, inputSchema.properties);
          Object.assign(cs.unionSchemas, inputSchema.unionSchemas);
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
        })
      )
      .transformer({$if: [
          (inputSchema => inputSchema.isUnion),
          [synthesizeKeyDiscrimination, synthesizeAutoDiscrimination, copyUnionOptions].map(p => p.bind(this))
        ]
      })
      .transformer( {$if: [
          (inputSchema => inputSchema.hasChildSelector || inputSchema.hasChildSelection),
          populateChildSelectorValues
        ]})
      .transformer(populateMetadata)
      .transformer(/** @type {OutputSchemaProcessor} */ async (inputSchema, _, location) => {
        if (location.path !== '') {
          return inputSchema;
        }
        if (inputSchema instanceof CompiledSchema) {
//          inputSchema.freeze();
          return inputSchema;
        }
        throw new SchemaError('Schema failed to compile!');
      })
      .validator(schemaValidator)
      .property('properties',
        new Schema('object')
//          .implicit()
          .property('*', schemaCompilerSchema)
      )
      .property('unionSchemas',
        new Schema('object')
//          .implicit()
          .property('*', schemaCompilerSchema)
      )
      .property('metadata',
        new Schema('object')
//          .implicit()
          .property('*', new Schema('string'))
      )
      .property('options',
        new Schema('object')
          .property('compileHook', new Schema('function'))
          .property('default', new Schema('any').option('dynamic', false))
//          .implicit()
          .property('values', new Schema('array')
// need deps for this to work            .normalizer(valuesNormalizer)
          )
          .property('*', new Schema('any'))
      )
      .property('handlers',
        new Schema('object')
//          .implicit()
          .property('normalizers', processorListSchema)
          .property('transformers', processorListSchema)
          .property('validators', processorListSchema)
          .property('serializers', processorListSchema)
          .property('conditions', processorListSchema)
          .property('discriminators', processorListSchema)
      );

    schemaCompilerSchema.unionSchema('schema', schemaSchema)

    const convertCache = new Map();

    const sc = this;
    function convert(src, dst) {
      if (convertCache.has(src)) {
        return convertCache.get(src);
      }
      if (dst === undefined) {
        dst = CS();
      }
      convertCache.set(src, dst);
      convertCache.set(dst, dst);  // I don't think this is necessary anymore?

      Object.assign(dst.options, src.options);
      Object.assign(dst.metadata, src.metadata);
      for (const [handler, processorSpecList] of Object.entries(src.handlers)) {
        dst.handlers[handler] = [resolver.compileProcessorSpec(processorSpecList)];
      }

      for (const [pk, pv] of Object.entries(src.properties)) {
        dst.properties[pk] = convert(pv)
      }
      for (const [uk, uv] of Object.entries(src.unionSchemas)) {
        dst.unionSchemas[uk] = convert(uv)
      }
      return dst;
    }

    convert(resolver.resolve(schemaCompilerSchema), this);
  }

  /**
   *
   * @param {CompiledSchema} cs
   * @param {string} [path]
   * @param {Set<CompiledSchema>} [seen]
   * @private
   */
  _replaceCachedReferences(cs, path = '', seen = new Set()) {
    if (seen.has(cs)) {
      return;
    }
    seen.add(cs);

    for (const [pk, pv] of Object.entries(cs.properties)) {
      const propertyPath = path? `${path}.${pk}` : pk;
      if (pv instanceof Schema) {

        const cached = this.compileCache.get(pv);
        if (cached === undefined) {
          throw new SchemaCompilationError('Unable to find cached CompiledSchema', {path: propertyPath})
        }
        cs.properties[pk] = cached;
      }
      this._replaceCachedReferences(cs.properties[pk], propertyPath, seen);
    }
    for (const [uk, uv] of Object.entries(cs.unionSchemas)) {
      if (uv instanceof Schema) {

        const cached = this.compileCache.get(uv);
        if (cached === undefined) {
          throw new SchemaCompilationError(`Unable to find cached CompiledSchema for unionSchema "${uk}"`, {path})
        }
        cs.unionSchemas[uk] = cached;
      }
      this._replaceCachedReferences(cs.unionSchemas[uk], path, seen);
    }
  }

  /**
   * @param {Schema|CompiledSchema|import("./types.js").SchemaData} inputSchema
   * @returns {Promise<any>}
   */
  async compile(inputSchema) {
    try {
      const compiledSchema = await this.process(inputSchema);

      this._replaceCachedReferences(compiledSchema);

      compiledSchema.freeze();

      return compiledSchema;
    }
    catch (error) {
      if (error instanceof SchemaCompilationError) {
        throw error;
      }
      else if ((error instanceof NormalizeError || error instanceof TransformError) && error.cause) {
        // these aren't interesting, but their internals are...
        throw new SchemaCompilationError(error.cause.message, {...error.data, ...error.cause.data, cause: error.cause});
      }
      else {
        throw new SchemaCompilationError('Error during compilation', {cause: error});
      }
    }
  }
}

function CS() {
  return new CompiledSchema(CompiledSchema.__TOKEN);
}

function CS_STRING(options = {}) {
  const cs = CS();
  cs.options.type = 'string';
  cs.handlers.normalizers = [stringNormalizer];
  Object.assign(cs.options, options);

  return cs;
}

function CS_OBJECT(options = {}) {
  const cs = CS();
  cs.options.type = 'object';
  cs.handlers.normalizers = [objectNormalizer];
  Object.assign(cs.options, options)

  return cs;
}


const stringNormalizer = {
  spec: '__string',
  processor: async (value) => {
    if (typeof value === 'object') {
      return stringify(value);
    }
    else {
      return String(value)
    }
  }
}

const arrayNormalizer = {
  spec: '__array',
  processor: async (value) => {
    if (value === true) {
      return [];
    }
    else if (Array.isArray(value)) {
      return value;
    }
    else {
      throw new SchemaError('not an array');
    }
  }
}

const objectNormalizer = {
  spec: '__object',
  processor: async (value) => {
    if (value === true) {
      return {};
    }
    else if (typeof value === 'object' && value !== null) {
      return value;
    }
    else {
      throw new SchemaError('not an object');
    }
  }
}




const schemaValidator = {
  spec: '__schema_validator',
  processor: async (schema, _, location, options) => {
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
}

const valuesNormalizer = {
  spec: '__values_normalizer',
  // FIXME - this can never work, rootSchema is opaque so always empty until everything is done!
  processor: async (inputValues, rootSchema, location, options) => {
    if (inputValues === undefined) {
      return undefined;
    }
    if (rootSchema === undefined) {
      return undefined;
    }
    const traversalState = options?.traversalState;
    if (!Array.isArray(inputValues)) {
      throw new SchemaError('values not an array');
    }
    // expects to have a normalizer handler on the output schema

//    const normalizersState = traversalState?.parent?.parent?.relative('handlers.normalizers');
//    const n = normalizersState.value;
//    if (n === undefined) {
//      return undefined;
//    }

    // the output schema should be two levels up in the rootSchema
    const outputSchemaLocation = location.parent?.parent;

    if (outputSchemaLocation === undefined) {
      return undefined;
    }
    const outputSchema = deepValue(rootSchema, outputSchemaLocation.path);

    const outputSchemaNormalizers = outputSchema?.handlers.normalizers;  // can we check in a different way?

    if (outputSchemaNormalizers === undefined) {
      return undefined;
    }

    const normalizedValues = [];

    for (const inputValue of inputValues) {
      // todo - make it possible so we can check if the normalizer is ready
      normalizedValues.push(await outputSchema._normalizeValue(inputValue));
    }
    return normalizedValues;

  }
}



const passthrough = {
  spec: '__passthrough',
  processor: async (input) => {
    return input;
  }
}


