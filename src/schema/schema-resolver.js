import { CompiledSchema } from './compiled-schema.js';
import { Schema } from './schema.js';
import { SchemaCompiler } from './schema-compiler.js';
import {
  ConfiguratorError,
  ConstraintError,
  ResolverError
} from '../errors.js';
import { toKebabCase } from '../utils.js';

import { ANY_SCHEMA } from './builtin-schemas/any-schema.js';
import { STRING_SCHEMA } from './builtin-schemas/string-schema.js';
import { NUMBER_SCHEMA } from './builtin-schemas/number-schema.js';
import { BOOLEAN_SCHEMA } from './builtin-schemas/boolean-schema.js';
import { OBJECT_SCHEMA } from './builtin-schemas/object-schema.js';
import { ARRAY_SCHEMA } from './builtin-schemas/array-schema.js';
import { DATE_SCHEMA } from './builtin-schemas/date-schema.js';
import { BUFFER_SCHEMA } from './builtin-schemas/buffer-schema.js';
import { FUNCTION_SCHEMA } from './builtin-schemas/function-schema.js';
import { getBuiltinProcessors } from './builtin-processors/index.js';
import { ROOT_SCHEMA } from './builtin-schemas/root-schema.js';
import { stringify } from './helpers/stringify.js';
import { formatArgumentType } from './helpers/format.js';

/** @import { SchemaData, SchemaValueProcessor, AsyncSchemaValueProcessor, ValueProcessorDefinition, ProcessorSpecCompiler, CompiledSpec, CompiledValueProcessorDefinition, ProcessorSpec, ValueProcessorBuilder } from './types.js' */

/**
 * The SchemaResolver class is used to compile a Schema into a CompiledSchema.
 *
 * It also defines a registry of named schemas, and a registry of keywords that correspond to value processors.
  */
export class SchemaResolver
{
  /**
   * @type {Map<string,Schema>}
   */
  #schemaMap = new Map();
  /**
   * @type {Map<string,ValueProcessorDefinition>}
   */
  #processorMap = new Map();

  #compilationCache = new Map();
  #resolveCache = new Map();
  #finalizationSet = new Set();

  constructor() {
    this._registerBuiltInSchemas();
    this._registerBuiltInValueProcessors()
  }

  /**
   * add a schema to the registry
   * @param {string} name
   * @param {Schema} schema
   * @returns {SchemaResolver}
   */
  registerSchema(name, schema) {
    if (!(schema instanceof Schema)) {
      throw new ResolverError(`Registry can only store Schema instances`);
    }
    const registryName = toKebabCase(name);
    this.#schemaMap.set(registryName, schema);
    return this;
  }

  /**
   * return the registered schema with a given name
   * @param {string} name
   * @returns {Schema}
   */
  getSchema(name) {
    const registryName = toKebabCase(name);
    const schema = this.#schemaMap.get(registryName);
    if (!schema) {
      throw new ResolverError(`Unable to resolve "${name}"`);
    }
    return schema;
  }

  /**
   * return true if there exists a registered schema with a given name
   * @param {string} name
   * @returns {boolean}
   */
  hasSchema(name) {
    const registryName = toKebabCase(name);
    return this.#schemaMap.has(registryName);
  }

  /**
   * Register a value processor definition
   * @param {ValueProcessorDefinition} definition
   * @returns {SchemaResolver}
   */
  registerValueProcessorDefinition(definition) {
    const {keyword, processor, description, builder} = definition;

    if (!keyword) {
      throw new ResolverError('Processor definition must have a keyword');
    }

    if (processor && builder) {
      throw new ResolverError(`Processor '${keyword}' cannot have both processor and builder`);
    }

    if (!processor && !builder) {
      throw new ResolverError(`Processor '${keyword}' must have processor or builder`);
    }

    if (description && typeof description !== 'string') {
      throw new ResolverError(`Processor description must be a string`);
    }

    this.#processorMap.set(keyword, definition);
    return this;
  }

  /**
   * register a named "simple" ValueProcessor
   * @param {string} keyword
   * @param {SchemaValueProcessor<any>} processor
   * @param {string} [description]
   * @returns {SchemaResolver}
   */
  registerValueProcessor(keyword, processor, description) {
    if (typeof processor !== 'function') {
      throw new ResolverError(`Processor for keyword '${keyword}' must be a function`);
    }
    return this.registerValueProcessorDefinition({
      keyword,
      processor,
      description: description ?? keyword
    });
  }

  /**
   * register a complex ValueProcessor that needs to be built based on schema processor spec
   * @param {string} keyword
   * @param {ValueProcessorBuilder} builder
   * @returns {SchemaResolver}
   */
  registerParameterizedValueProcessor(keyword, builder) {
    if (typeof builder !== 'function') {
      throw new ResolverError(`Processor builder for keyword '${keyword}' must be a function`);
    }
    return this.registerValueProcessorDefinition({
      keyword,
      builder
    });
  }

  /**
   * @private
   */
  _registerBuiltInSchemas() {
    this.registerSchema('root-schema', ROOT_SCHEMA);
    this.registerSchema('any', ANY_SCHEMA);
    this.registerSchema('string', STRING_SCHEMA);
    this.registerSchema('number', NUMBER_SCHEMA);
    this.registerSchema('boolean', BOOLEAN_SCHEMA);
    this.registerSchema('object', OBJECT_SCHEMA);
    this.registerSchema('array', ARRAY_SCHEMA);
    this.registerSchema('date', DATE_SCHEMA);
    this.registerSchema('buffer', BUFFER_SCHEMA);
    this.registerSchema('function', FUNCTION_SCHEMA);
  }

  /**
   * @private
   */
  _registerBuiltInValueProcessors() {
    for (const definition of getBuiltinProcessors()) {
      this.registerValueProcessorDefinition(definition);
    }
  }

  /**
   * Wrap or convert a user-provided processor specification into a processor function
   * @param {ProcessorSpec} spec - The processor specification
   * @returns {CompiledValueProcessorDefinition}
   */
  compileProcessorSpec(spec) {
    if (spec === null || spec === '$null') {
      // special case: explicit prune
      return {
        spec: '$null',
        processor: async _ => null,
        description: 'null'
      }
    }
    if (spec === undefined || (Array.isArray(spec) && spec.length === 0)) {
      return {
        spec: [],
        processor: async (value) => value,
//        description: 'any'
      }
    }
    if (Array.isArray(spec)) {
      if (spec.length === 1) {
        spec = spec[0];
      }
      else {
        spec = {$pipeline: spec};
      }
    }

    if (typeof spec === 'function') {
      return {
        spec,
        processor: this._asyncifySVP(spec),  // wrap in async to ensure we can manage exceptions
        description: undefined
      }
    }

    if (typeof spec === 'string' && spec.startsWith('/') && spec.lastIndexOf('/') > 0) {
      // String regex pattern "/pattern/flags" - parse and fall through to the regex rule
      const lastSlash = spec.lastIndexOf('/');
      const pattern = spec.slice(1, lastSlash);
      const flags = spec.slice(lastSlash + 1);

      try {
        spec = new RegExp(pattern, flags);
      }
      catch (error) {
        throw new ResolverError(`Invalid regex pattern: ${spec}`);
      }
    }

    // Regular expression object
    if (spec instanceof RegExp) {
      return {
        spec,
        processor: async (value) => {
          if (!spec.test(String(value))) {
            throw new ConstraintError(`Value does not match pattern ${spec}`);
          }
          return value;
        },
        description: spec.toString()
      };
    }

    // Simple keyword handling
    if (typeof spec === 'string' && spec.startsWith('$')) {
      const keyword = spec.slice(1);
      const registered = this.#processorMap.get(keyword);

      if (!registered) {
        throw new ResolverError(`Unknown processor keyword: ${spec}`);
      }
      if (registered.builder) {
        throw new ResolverError(`Processor keyword ${spec} requires arguments`);
      }
      if (typeof registered.processor !== 'function') {
        throw new ResolverError(`No processor function defined for keyword: ${spec}`);
      }

      return {
        spec,
        processor: this._asyncifySVP(registered.processor),
        description: registered.description // ?? keyword - todo - check if keyword is already added elsewhere
      }
    }

    // Might be a parameterized keyword, might be a processor definition
    if (typeof spec === 'object') {
      let def = spec;

      const keys = Object.keys(spec);
      if (keys.length === 1) {
        const [keyword] = keys;
        if (keyword.startsWith('$')) {
          const keywordName = keyword.startsWith('$') ? keyword.slice(1) : keyword;
          const args = spec[keyword];

          const registered = this.#processorMap.get(keywordName);

          if (!registered) {
            throw new ResolverError(`Unknown processor keyword: ${keyword}`);
          }
          if (registered.builder) {
            // Parameterized validator - pass args and recursive compiler
            def = registered.builder(args, (spec) => this.compileProcessorSpec(spec));
            def.spec = spec;
            // Fall through;
          }
          else {
            throw new ResolverError(`Processor ${keyword} does not accept arguments`);
          }
        }
        // not a keyword, fall through and interpret as a processor definition;
      }

      if (def.spec === undefined) {
        throw new ResolverError('Invalid processor definition (no spec or keyword)');
      }

      if (def.processor) {
        return def;  // already compiled!
      }

      const compiled = this.compileProcessorSpec(def.spec);
      if (def.description) {
        compiled.description = `${def.description}`;
      }
      return compiled;
    }

//    throw new ResolverError(`Invalid processor specification: ${spec}`);

    // anything else: it's essentially a constant
    const description = stringify(spec);
    return {
      spec,
      processor: async (value, target, location) => {
        // if the value passed in is undefined, we'll synthesize the passed value
        if (value !== undefined && value !== spec) {
          throw new ConstraintError('Must have exact', {value: spec, location});
        }
        return value;
      },
      description
    }
  }

  compiler() {
    return new SchemaCompiler(this);
  }


  /**
   * Build a compiled schema from the schema definition.
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @returns {Promise<CompiledSchema>}
   */
  async compile(inputSchema) {
    if (inputSchema instanceof CompiledSchema) {
      return inputSchema;
    }
    const compiler = new SchemaCompiler(this);
    return await compiler.compile(inputSchema);
  }

  /**
   * Create a new Schema that contains the flattened hierarchy of all resolved base schemas.
   *
   * This can be useful if you need to make changes to the full schema, e.g. prepending processors
   * before the base class handlers.
   *
   * @param {Schema|CompiledSchema|SchemaData|string} inputSchema
   * @param {boolean} [recursive]
   * @returns {Schema|CompiledSchema}
   */
  resolve(inputSchema, recursive = true) {
    if (inputSchema instanceof CompiledSchema) {
      return inputSchema;
    }
    if (typeof inputSchema === 'string') {
      inputSchema = this.getSchema(inputSchema);
    }
    if (this.#resolveCache.has(inputSchema)) {
      return this.#resolveCache.get(inputSchema);
    }
    const outputSchema = new Schema();

    this.#resolveCache.set(inputSchema, outputSchema);
    this.#resolveCache.set(outputSchema, outputSchema);

    /** @type {Schema|CompiledSchema|SchemaData|undefined} */
    let source = inputSchema;

    let strictCompileError;

    let foundType = false;  // we need to hit one of our fundamental types, otherwise we'll use "any"

    while (source !== undefined) {
      for (const [propName, propSchema] of Object.entries(source.properties ?? {})) {
        if (!outputSchema.properties.hasOwnProperty(propName)) {
          const needsResolve = recursive || !(propSchema instanceof Schema || propSchema instanceof CompiledSchema)
          outputSchema.properties[propName] = needsResolve ? this.resolve(propSchema) : propSchema;
        }
      }
      for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
        if (!outputSchema.metadata.hasOwnProperty(metaName)) {
          outputSchema.metadata[metaName] = metaValue;
        }
      }
      for (const [discriminatorValue, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
        if (!outputSchema.unionSchemas.hasOwnProperty(discriminatorValue)) {
          const needsResolve = recursive || !(unionSchema instanceof Schema || unionSchema instanceof CompiledSchema)
          outputSchema.unionSchemas[discriminatorValue] = needsResolve ? this.resolve(unionSchema) : unionSchema;
        }
      }
      for (const [handlerName, handlerValues] of Object.entries(source.handlers ?? {})) {
        // TODO - add an option that enables a schema to opt out of base handler inheritance
        if (!outputSchema.handlers.hasOwnProperty(handlerName)) {
          outputSchema.handlers[handlerName] = [];
        }
        outputSchema.handlers[handlerName].unshift(...handlerValues);
      }

      for (const [optionName, optionValue] of Object.entries(source.options ?? {})) {
        if (!outputSchema.options.hasOwnProperty(optionName)) {
          outputSchema.options[optionName] = optionValue;
          if (optionName === 'type') {
            foundType = true;
          }
        }
      }
      if (source instanceof CompiledSchema) {
        source = undefined;
      }
      else {
        if (source.base === undefined && !foundType) {
          source.base = 'any';
        }

        if (source.base) {
          if (this.hasSchema(source.base)) {
            source = this.getSchema(source.base);
          }
          else {
            // base schema is undefined; this is only an error if you actually try to use it
            // allow error to be omitted if the schema is marked "lax"
            const base = `${source.base}`

            strictCompileError = new ResolverError(`Unable to resolve "${base}"`)
            outputSchema.normalizer((value, config, location, options) => {
              const strict = location.schema?.strict ?? options?.strict;
              if (strict !== false) {
                throw strictCompileError;
              }
              return undefined;
            });
            source = undefined;
          }
        }
        else {
          source = undefined;
        }
      }
      //source = (source instanceof CompiledSchema)? undefined : (source.base ? this.getSchema(source.base) : undefined);
    }
    if (!(inputSchema instanceof CompiledSchema) && inputSchema.base && !outputSchema.metadata.parserTypeHint) {
      outputSchema.metadata.parserTypeHint = inputSchema.base;
    }
    if (outputSchema.options.strict !== false && strictCompileError) {
      throw strictCompileError;
    }
    return outputSchema;
  }


  /**
   * @template TReturn
   * @param {SchemaValueProcessor<TReturn>|TReturn} fn
   * @param {TReturn} [d]
   * @returns {AsyncSchemaValueProcessor<TReturn>}
   * @private
   */
  _asyncifySVP(fn, d) {
    return async (value, target, location, options) => {

      if (!location) {
        throw new ConfiguratorError('Invalid call to schema value function');  // developer error
      }

      if (!fn) {
        return value ?? d
      }
      if (typeof fn === 'function') {
        // @ts-ignore
        return fn(value, target, location, options);
      }
      return fn;
    }
  }


}