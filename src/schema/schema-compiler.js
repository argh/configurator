import { CompiledSchema } from './compiled-schema.js';
import { SchemaResolver } from './schema-resolver.js';
import { Schema, SchemaPolicy } from './schema.js';

import {
  copyUnionOptions, synthesizeKeyDiscrimination, synthesizeAutoDiscrimination,
} from './compilation/union-compilation.js';
import { SchemaLocation } from "./schema-location.js";
import { populateChildSelectorValues } from './compilation/selection-compilation.js';
import { populateMetadata } from './compilation/metadata-compilation.js';
import { normalizeSchema, transformSchema, validateSchema } from './compilation/schema-compilation.js';
import { TraversalContext } from './traversal/index.js';
import {
  FinalizeError,
  NormalizeError,
  SchemaCompilationError,
  SchemaError,
  TransformError,
  ValidationError
} from './schema-errors.js';
import { isKeywordValueProcessorSpec } from './value-processor/spec.js';
import { isEmpty, isPlainObject } from '../utils.js';
import { ValueProcessor } from './value-processor/value-processor.js';
import { compileHandlers } from './compilation/handler-compilation.js';
import { normalizeValues } from './compilation/values-compilation.js';
import { formatValue } from "../errors.js";

/** @typedef {(inputSchema:CompiledSchema|Schema, targetSchema:CompiledSchema, location:SchemaLocation, options?:object) => Promise<Schema|CompiledSchema|import("./types.js").SchemaData|undefined>} InputSchemaProcessor */
/** @typedef {(inputSchema:CompiledSchema, targetSchema:CompiledSchema, location:SchemaLocation, options?:object) => Promise<CompiledSchema|undefined>} OutputSchemaProcessor */


// TODO - idea: broaden the concept of discriminators to "schemaResolvers" that can produce any replacement schema on demand.
//        then, make circular schema references be a dynamic resolver concept?

/**
 * This is a marker class for type safety that is replaced before the schema is used.
 */
export class CachedSchemaReference extends CompiledSchema {
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

    this.normalizeCache = new Map();

    this.compileSeen = new Map();
    this.compileCache = new Map();

    const compiler = this;

    // We'll use Schema's fluent setters to carefully define a "Schema Schema", and then extract its guts.

    const valueProcessorSchema = new Schema('any')
      .option('dynamic', false)
      .opaque()
      .validator((p, _target, location) => {
        if (!(p instanceof ValueProcessor)) {
          throw new SchemaCompilationError('Failed to compile to a value processor', {location});
        }
        return p;
      })

    const simpleKeywordSpecSchema = new Schema(valueProcessorSchema)
      .transformer(spec => {
        return resolver.compileKeywordValueProcessorSpec(this, spec)
      })

    const verboseKeywordSpecSchema = new Schema(valueProcessorSchema)
      .property('$literal', new Schema('any'))
      .transformer(spec => {
        return resolver.compileKeywordValueProcessorSpec(this, spec)
      })

    const generalSpecSchema = new Schema(valueProcessorSchema)
      .transformer(spec => {
        return resolver.compileValueProcessorSpec(this, spec)
      })

    const specSchema = new Schema(valueProcessorSchema)
      .normalizer((spec) => {
        if (spec === null) {
          return '$null';
        }
        return spec;
      })
// union - never transformed
//      .transformer(spec => {
//        return resolver.compileKeywordValueProcessorSpec(spec)
//      })
      .unionDiscriminator(spec => {
        if (spec instanceof ValueProcessor) {
          return 'general';
        }
        if (spec === null || spec === undefined) {
          return 'general';
        }
        if (isEmpty(spec)) {
          // todo - can $literal be used to allow deliberately empty specs?
          return undefined;
        }
        if (isKeywordValueProcessorSpec(spec)) {
          return typeof spec === 'string' ? 'keyword' : 'keyword+args';
        }
        return 'general';
      })
      .unionSchema('keyword', simpleKeywordSpecSchema)
      .unionSchema('keyword+args', verboseKeywordSpecSchema)
      .unionSchema('general', generalSpecSchema)

    const keywordArgumentsSchema = new Schema('any')
      .option('dynamic', false)
      .unionDiscriminator(spec => {
        if (Array.isArray(spec)) { return 'array'}           // array for arguments is always parameters

        if (isKeywordValueProcessorSpec(spec)) { return 'spec' }
        if (isEmpty(spec)) { return undefined; }  // might be a keyword once filled in
        if (isPlainObject(spec)) { return 'object'}
        return 'spec';
      })
      .unionSchema('spec', specSchema)
      .unionSchema('array', new Schema('array')
        //.opaque()
        .transformer(pa => {
          return pa; // todo - verify parameters
        })
        .property('*', specSchema))
      .unionSchema('object', new Schema('object')
        //.opaque()
        .transformer(po => {
          return po;  // todo - verify parameters
        })
        .property('*', specSchema))

    verboseKeywordSpecSchema.property('*', keywordArgumentsSchema)


    const pipelineSchema = new Schema('array')
      .property('*', specSchema)
//      .transformer(speclist => {
//        return resolver.compileProcessorPipeline(speclist);
//      })

    // fixme - well, mostly fixed now, but here's the former comment:
    // the problem is that this schema is an "any", so it doesn't normalize the input schema at all,
    // ...it makes it all the way to the resolver phase, gets resolved, but then it won't iterate
    // the children because it isn't a "simple object".
    //
    // the old compiler presumably fixed this by doing a full restart of the traversal with the new schema.
    // we don't have a good mechanism for that yet.  :-/
    //
    // otherwise we need a compatible normalizer, which I'm not sure is possible.


    const schemaCompilerSchema = new Schema()
      .meta('compiler', 'root')
/*
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
 */
      .normalizer((inputSchema, _, location) => {
        if (this.compileSeen.has(inputSchema) && this.compileSeen.get(inputSchema) !== location.path) {
          return new CachedSchemaReference(inputSchema);
        }
        if (inputSchema instanceof CompiledSchema) {
          return inputSchema;
        }
        this.compileSeen.set(inputSchema, location.path);
        return inputSchema
      })
      .normalizer(normalizeSchema.bind(this))

      // note: we must only return strings while compiling to prevent dogfood confusion about union schemas!
      .unionDiscriminator((s, _, location, options) => {
        if (s instanceof CachedSchemaReference) {
          return 'cache';
        }
        if (this.compileSeen.has(s)) {
          return 'cache';
        }
        else if (s instanceof CompiledSchema) {
          return 'reference';
        }
        else if (typeof s === 'object') {
          return 'schema';
        }
        else {
          return undefined;
        }
      })

      .unionSchema('reference', new Schema()
        .meta('compiler', 'reference')
        .required()
        .normalizer(s => {
          if (!(s instanceof CompiledSchema)) {
            throw new SchemaCompilationError('Not a CompiledSchema reference!');
          }
          return s;
        })
      )
      .unionSchema('cache', new Schema()
        .meta('compiler', 'cache')
        .required()
        .normalizer(s => {
          if (s instanceof CachedSchemaReference) {
            return s;
          }
          if (!(s instanceof Schema)) {
            throw new SchemaCompilationError('Can only cache references to schemas')
          }
          return new CachedSchemaReference(s);   // fixme gahhhhhh we never get here, only normalized via main union
        })
        /* note to self: can't have a transformer find the completed schema in the cache because
           there's a chicken and egg problem; opaque schema won't transform without all properties complete,
           but a property that depends on the parent schema can't complete!  revisit if we ever make the schema incremental.
        .transformer(s => {
          if (!(s instanceof CachedSchemaReference)) {
            throw new SchemaCompilationError('not a cached schema');
          }
          const compiledSchema = this.compileCache.get(s.schema);
          return compiledSchema;
        })

         */
      )

    // The schema needs to be opaque right now because it contains internals that have a complex
    // resolution dependency chain that cannot (yet) be expressed in the schema itself:
    //
    // values depends on normalizers
    // discriminators is a default, but depends on checking values
    // selector and selection depend on condition and values
    //
    // validation depends on everything being configured properly as it checks options/children
    //
    // note that by the time this schema has been resolved, we're beyond normalizing inputs, and only
    // normalizing a new empty schema data being built

    const schemaSchema = new Schema('object')
      .meta('compiler', 'schema')
      .opaque()
      .normalizer(normalizeSchema.bind(this))  // if we traverse again, we should get the cached version

      .normalizer(
         (inputSchema, _target, _location, _options) => {
          if (inputSchema instanceof CompiledSchema) {
            return inputSchema;
          }
          else if (typeof inputSchema === 'object') {
            if (inputSchema instanceof Schema) {
              throw new SchemaCompilationError('Internal compiler error');
              //return resolver.resolve(inputSchema, false);  // this should never happen!  should have been normalized to {}
            }
            else {
              return inputSchema;
            }
          }
          else {
            throw new SchemaError('not a schema');
          }
        }
      )
//      .normalizer(normalizeSchema.bind(this))
      .transformer(transformSchema.bind(this))

      .finalizer({$if: [
          (inputSchema => inputSchema.isUnion),
          {$pipeline: [synthesizeKeyDiscrimination, synthesizeAutoDiscrimination, copyUnionOptions].map(p => p.bind(this))},
          '$input'
        ]
      })
      .finalizer(compileHandlers.bind(this))  // needs to be after discriminator synthesis

      .finalizer({$if: [
          (compiledSchema => !isEmpty(compiledSchema.options.values)),
          normalizeValues.bind(this),  // requires handlers; conditional to avoid async when not needed
          '$defined'
        ]
      })

/*
      .finalizer({$if: [
          (compiledSchema => compiledSchema.hasValues),
          {
            $gate: [
              {
                $invoke: {
                  processor: {
                    $pipeline: [
                      (compiledSchema => compiledSchema.options.values),
                      {
                        $each: (value, _target, _location, options) => {
                          return options.args.schema._normalizeValue(value);
                        }
                      },
                      (values, _target, _location, options) => {
                        options.args.schema.options.values = values;
                        return options.args.schema;
                      }
                    ]
                  },
                  arguments: {schema: '$input'}
                }
              },
              '$input',
              '$input'
            ]
          },
          '$input'

        ]
      })
*/
      .finalizer( {$if: [
          (inputSchema => inputSchema.hasChildSelector || inputSchema.hasChildSelection),
          populateChildSelectorValues,
          '$defined'
        ]})
      .finalizer(populateMetadata)
      .finalizer((compiledSchema, _rootSchema, location) => {
        if (location.path !== '') {
          return compiledSchema;
        }
        if (!(compiledSchema instanceof CompiledSchema)) {
          throw new SchemaCompilationError('Schema failed to compile!');
        }
        // Replace placeholders (marking circular references) with their final compiled versions.
        this._replaceCachedReferences(compiledSchema);

        compiledSchema._freeze();
        return compiledSchema;
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
          .property('*', new Schema('string'))  // FIXME - CommandLineSource interprets some metadata as booleans!
      )
      .property('options',
        new Schema('object')
          .property('compileHook', new Schema('function'))
          .property('default', new Schema('any').option('dynamic', false))
//          .implicit()
          .property('values', new Schema('array'))
          .property('*', new Schema('any'))
      )
      .property('handlers',
        new Schema('object')
//          .implicit()
          .property('normalizers', pipelineSchema)
          .property('transformers', pipelineSchema)
          .property('finalizers', pipelineSchema)
          .property('validators', pipelineSchema)
          .property('serializers', pipelineSchema)
          .property('conditions', pipelineSchema)
          .property('discriminators', pipelineSchema)
      );

    schemaCompilerSchema.unionSchema('schema', schemaSchema)

    const convertCache = new Map();

    /**
     * This function acts as the primordial "compiler" that builds the actual SchemaCompiler.
     *
     * The Schema that defines Schemas is deliberately constrained in the features it uses.
     * This allows us to "compile it" without requiring the full complexity of the full compilation process.
     *
     * @param {Schema|CompiledSchema} src
     * @param {CompiledSchema} [dst]
     * @returns {CompiledSchema}
     */
    function compileSchemaCompiler(src, dst) {
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
//        dst.handlers[handler] = [resolver.compileProcessorSpec(processorSpecList)];
        dst.handlers[handler] = processorSpecList.map(spec => resolver.compileValueProcessorSpec(compiler, spec, true));
        dst._setValueProcessor(handler, resolver.compileValueProcessorSpec(compiler,{$pipeline: dst.handlers[handler]}));
      }

      for (const [pk, pv] of Object.entries(src.properties)) {
        if (!(pv instanceof Schema || pv instanceof CompiledSchema)) {
          continue;  // impossible
        }
        dst._setPropertySchema(pk, compileSchemaCompiler(pv));
      }
      for (const [uk, uv] of Object.entries(src.unionSchemas)) {
        if (!(uv instanceof Schema || uv instanceof CompiledSchema)) {
          continue;  // impossible
        }
        dst._setUnionSchema(uk, compileSchemaCompiler(uv));
      }
      return dst;
    }

    compileSchemaCompiler(resolver.resolve(schemaCompilerSchema), this);
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
      if (pv !== pvr) {
        pv.metadata.references ??= '';
        pv.metadata.references += `[${propertyPath}]`
        cs._setPropertySchema(pk, pv);
      }

      this._replaceCachedReferences(pv, propertyPath, seen);
    }
    for (const [uk, uvr] of cs.unionSchemaEntries) {
      const uv = (uvr instanceof CachedSchemaReference)? this.compileCache.get(uvr.schema) : uvr;
      if (uv === undefined) {
        throw new SchemaCompilationError(`Unable to find cached CompiledSchema for unionSchema "${uk}"`, {path})
      }
      if (uv !== uvr) {
        uv.metadata.references ??= '';
        uv.metadata.references += `[${path}:${uk}]`;
        cs._setUnionSchema(uk, uv);
      }
      this._replaceCachedReferences(uv, path, seen);
    }
  }

  /**
   * Compile a Schema to a CompiledSchema
   *
   * Schemas are compiled using a schema that defines schemas!  This method is a convenience facade over the regular
   * "process" flow.
   *
   * @param {Schema|CompiledSchema|import("./types.js").SchemaData} inputSchema
   * @returns {Promise<CompiledSchema>}
   */
  async compile(inputSchema) {
    try {
      const context = new TraversalContext(new SchemaLocation(this));
      return await this.process(inputSchema, undefined, {context});
    }
    catch (error) {
      if (error instanceof SchemaCompilationError) {
        throw error;
      }
      else if ((error instanceof NormalizeError || error instanceof TransformError || error instanceof FinalizeError || error instanceof ValidationError) && error.cause) {
        // these aren't interesting, but their internals are...
        throw new SchemaCompilationError(error.cause.message, {...error.data, ...error.cause.data, cause: error.cause});
      }
      else {
        throw new SchemaCompilationError('Error during compilation', {cause: error});
      }
    }
  }
}



