import { CompiledSchema } from './compiled-schema.js';
import { SchemaResolver } from './schema-resolver.js';
import { Schema } from './schema.js';
import { NormalizeError, SchemaCompilationError, SchemaError, TransformError } from '../errors.js';

import {
  copyUnionOptions, synthesizeKeyDiscrimination, synthesizeAutoDiscrimination,
} from './compilation/union-compilation.js';
import { SchemaLocation } from "./schema-location.js";
import { populateChildSelectorValues } from './compilation/selection-compilation.js';
import { populateMetadata } from './compilation/metadata-compilation.js';
import { normalizeSchema, transformSchema, validateSchema } from './compilation/schema-compilation.js';

/** @typedef {(inputSchema:CompiledSchema|Schema, targetSchema:CompiledSchema, location:SchemaLocation, options?:object) => Promise<Schema|CompiledSchema|import("./types.js").SchemaData|undefined>} InputSchemaProcessor */
/** @typedef {(inputSchema:CompiledSchema, targetSchema:CompiledSchema, location:SchemaLocation, options?:object) => Promise<CompiledSchema|undefined>} OutputSchemaProcessor */


// TODO - idea: broaden the concept of discriminators to "schemaResolvers" that can produce any replacement schema on demand.
//        then, make circular schema references be a dynamic resolver concept?

/**
 * This is a marker class for type safety that is replaced before the schema is used.
 */
class CachedSchemaReference extends CompiledSchema {
  /**
   * @param {Schema} schema
   */
  constructor(schema) {
    super(CompiledSchema.__TOKEN);
    this.schema = schema;
  }
}

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
          return new CachedSchemaReference(s);
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
        async (inputSchema) => {
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
      .normalizer(normalizeSchema.bind(this))
      .transformer(transformSchema.bind(this))

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
//          inputSchema._freeze();
          return inputSchema;
        }
        throw new SchemaError('Schema failed to compile!');
      })
      .validator(validateSchema.bind(this))
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

    /**
     * @param {Schema|CompiledSchema} src
     * @param {CompiledSchema} [dst]
     * @returns {CompiledSchema}
     */
    function convert(src, dst) {
      if (convertCache.has(src)) {
        return convertCache.get(src);
      }
      if (src instanceof CompiledSchema) {
        return src;
      }
      if (dst === undefined) {
        dst = new CompiledSchema(CompiledSchema.__TOKEN);
      }
      convertCache.set(src, dst);
      convertCache.set(dst, dst);  // I don't think this is necessary anymore?

      Object.assign(dst.options, src.options);
      Object.assign(dst.metadata, src.metadata);
      for (const [handler, processorSpecList] of Object.entries(src.handlers)) {
        dst.handlers[handler] = [resolver.compileProcessorSpec(processorSpecList)];
      }

      for (const [pk, pv] of Object.entries(src.properties)) {
        if (!(pv instanceof Schema || pv instanceof CompiledSchema)) {
          continue;  // impossible
        }
        dst._setPropertySchema(pk, convert(pv));
      }
      for (const [uk, uv] of Object.entries(src.unionSchemas)) {
        if (!(uv instanceof Schema || uv instanceof CompiledSchema)) {
          continue;  // impossible
        }
        dst._setUnionSchema(uk, convert(uv));
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

    for (const [pk, pvr] of cs.propertyEntries) {
      const propertyPath = path? `${path}.${pk}` : pk;
      const pv = (pvr instanceof CachedSchemaReference)? this.compileCache.get(pvr.schema) : pvr;
      if (pv === undefined) {
        throw new SchemaCompilationError('Unable to find cached CompiledSchema', {path: propertyPath})
      }
      cs._setPropertySchema(pk, pv);
      this._replaceCachedReferences(pv, propertyPath, seen);
    }
    for (const [uk, uvr] of cs.unionSchemaEntries) {
      const uv = (uvr instanceof CachedSchemaReference)? this.compileCache.get(uvr.schema) : uvr;
      if (uv === undefined) {
        throw new SchemaCompilationError(`Unable to find cached CompiledSchema for unionSchema "${uk}"`, {path})
      }
      cs._setUnionSchema(uk, uv);
      this._replaceCachedReferences(uv, path, seen);
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

      compiledSchema._freeze();

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





const passthrough = {
  spec: '__passthrough',
  processor: async (input) => {
    return input;
  }
}


