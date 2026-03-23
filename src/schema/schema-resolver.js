import { CompiledSchema } from './compiled-schema.js';
import { Schema } from './schema.js';
import { SchemaCompiler } from './schema-compiler.js';
import {
  ConfiguratorError, formatValue
} from '../errors.js';
import { isEmpty, isPlainObject, map, toKebabCase } from '../utils.js';

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
import { ConstraintError, ResolverError, SchemaError } from './schema-errors.js';
import { PipelineExecutor } from './executor/pipeline-executor.js';
import {
  ConstantExecutor,
  Executor, FALSE_EXECUTOR,
  FunctionExecutor,
  NULL_EXECUTOR,
  toExecutor, TRUE_EXECUTOR,
  UNDEFINED_EXECUTOR
} from './executor/executor.js';
import { FunctionValueProcessor } from './value-processor/function-value-processor.js';
import {
  extractKeywordValueProcessorSpec,
  isKeywordValueProcessorSpec,
  isLegalValueProcessorSpec
} from './value-processor/spec.js';
import { ComposedValueProcessor } from './value-processor/composed-value-processor.js';
import { ValueProcessor } from './value-processor/value-processor.js';
import { ObjectExecutor } from './executor/object-executor.js';
import { ArrayExecutor } from './executor/array-executor.js';
import { ParametersValueProcessor } from './value-processor/parameters-value-processor.js';
import { DefinedValueProcessor } from './value-processor/defined-value-processor.js';

/** @import { SchemaData } from './types.js' */
/** @import { ValueProcessorDefinition, ValueProcessorSpec, ValueProcessorBuilder, ValueProcessorFunction, ValueProcessorArgs, ValueProcessorParameter, KeywordValueProcessorSpec } from './value-processor/value-processor.js' */

/**
 * The SchemaResolver uses its internal registries of named schemas and value processor keywords to
 * convert Schemas containing unresolved references into resolved Schemas that are fully self-contained.
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
    const {keyword, process, description, build} = definition;

    if (!keyword) {
      throw new ResolverError('Missing keyword in processor definition');
    }

    if (process && build) {
      throw new ResolverError(`Processor definition for '${keyword}' cannot define both process and build functions`);
    }

    if (!process && !build) {
      throw new ResolverError(`Processor definition for '${keyword}' must have define a process or build function`);
    }

    if (description && typeof description !== 'string') {
      throw new ResolverError(`Processor definition description for '${keyword}' must be a string`);
    }

    this.#processorMap.set(keyword, definition);
    return this;
  }

  /**
   * register a named "simple" ValueProcessor
   * @param {string} keyword
   * @param {ValueProcessorFunction} process
   * @param {string} [description]
   * @returns {SchemaResolver}
   */
  registerValueProcessor(keyword, process, description) {
    if (typeof process !== 'function') {
      throw new ResolverError(`Processor for keyword '${keyword}' must be a function`);
    }
    return this.registerValueProcessorDefinition({
      keyword,
      parameters: [],
      process,
      description: description ?? keyword
    });
  }

  /**
   * register a complex ValueProcessor that needs to be built based on schema processor spec
   * @param {string} keyword
   * @param {ValueProcessorBuilder} build
   * @returns {SchemaResolver}
   */
  registerValueProcessorBuilder(keyword, build) {
    if (typeof build !== 'function') {
      throw new ResolverError(`Processor builder for keyword '${keyword}' must be a function`);
    }
    return this.registerValueProcessorDefinition({
      keyword,
      build
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

  _constantKeywords = {
    $null: NULL_EXECUTOR,
    $undefined: UNDEFINED_EXECUTOR,
    $true: TRUE_EXECUTOR,
    $false: FALSE_EXECUTOR
  }

  /**
   * @param {SchemaCompiler} compiler
   * @param {KeywordValueProcessorSpec} spec
   * @param {boolean} [recursive]
   * @returns {ValueProcessor}
   */
  compileKeywordValueProcessorSpec(compiler, spec, recursive) {
    if (!isKeywordValueProcessorSpec(spec)) {
      throw new ResolverError('Not a keyword processor spec');
    }
    const [keyword, rawArgs] = extractKeywordValueProcessorSpec(spec);

    if (this._constantKeywords[spec]) {
      return new ComposedValueProcessor(this._constantKeywords[spec], spec);
    }

    if (keyword === 'literal') {
      // note that in the semantically odd case where a user didn't provide args, the literal will be an empty array!
      return new ComposedValueProcessor(new ConstantExecutor(rawArgs), spec);
    }

    const definition = this.#processorMap.get(keyword);

    if (!definition) {
      throw new ResolverError(`Unknown processor keyword: $${keyword}`);
    }
    // This "map" call will wrap any non-collection as an array:
    const args = map(rawArgs, arg => this.compileValueProcessorSpec(compiler, arg, recursive));

    if (definition.build) {
      const processor = definition.build(args, {compiler});
      if (processor?.['process']) {
        return this.compileValueProcessorSpec(compiler, processor, recursive);
      }
      if (!(processor instanceof ValueProcessor)) {
        throw new SchemaError(`ValueProcessor builder for $${keyword} returned invalid`, {value:processor});
      }
      return processor;
    }
    return new DefinedValueProcessor(definition, args);
  }


  compileSchemaValueProcessorSpec(compiler, spec) {
    let compiledSchema;
    return new ComposedValueProcessor(
      new FunctionExecutor(
        async () => {
          compiledSchema ??= (spec instanceof CompiledSchema)? spec : await compiler.compile(spec);
          return compiledSchema;
        }
      ), spec);
  }

  /**
   * Convert a processor specification into an executor
   * @param {SchemaCompiler} compiler
   * @param {ValueProcessorSpec} spec - The processor specification
   * @param {boolean} [recursive]
   * @returns {ValueProcessor}
   */
  compileValueProcessorSpecObject(compiler, spec, recursive = false) {

    if (typeof spec !== 'object') {
      throw new ResolverError('not a spec object');
    }

    /** @type {{[key:string]:ValueProcessor}} */
    const out = {};
    for (const [key, value] of Object.entries(spec)) {
      out[key] = this.compileValueProcessorSpec(compiler, value, recursive);
    }
    return new ComposedValueProcessor(new ObjectExecutor(out), map(out, p => p.spec));
  }

  /**
   * Convert a processor specification into an executor
   * @param {SchemaCompiler} compiler
   * @param {ValueProcessorSpec} spec - The processor specification
   * @param {boolean} [recursive]
   * @returns {ValueProcessor}
   */
  compileValueProcessorSpecArray(compiler, spec, recursive = false) {

    if (!Array.isArray(spec)) {
      throw new ResolverError('not a spec array');
    }
    /** @type {ValueProcessor[]} */
    const out = [];
    for (let i = 0; i < spec.length; ++i) {
      out[i] = this.compileValueProcessorSpec(compiler, spec[i], recursive);
    }
    return new ComposedValueProcessor(new ArrayExecutor(out), map(out, p => p.spec));
  }


  /**
   * Convert a value processor specification into a value processor executor
   *
   * @param {SchemaCompiler} compiler
   * @param {ValueProcessorSpec} spec - The processor specification
   * @param {boolean} [recursive]
   * @returns {ValueProcessor}
   */
  compileValueProcessorSpec(compiler, spec, recursive = false) {

    if (!isLegalValueProcessorSpec(spec)) {
      throw new SchemaError(`Invalid value processor specification`, {value: spec});
    }

    /** @type {ValueProcessor} */
    let valueProcessor;

    if (spec === undefined) {
      valueProcessor = new ValueProcessor(); // passthrough
    }
    else if (spec === null) {
      spec = '$null';
      valueProcessor = new ComposedValueProcessor(NULL_EXECUTOR, '$null');
    }
    else if (spec === '$resolver') {
      valueProcessor = new ComposedValueProcessor(new ConstantExecutor(this), spec);
    }
    else if (spec === '$compiler') {
      valueProcessor = new ComposedValueProcessor(new ConstantExecutor(compiler), spec);
    }
    else if (spec instanceof ValueProcessor) {
      valueProcessor = spec;
    }
    else if (spec instanceof Schema) {
      valueProcessor = this.compileSchemaValueProcessorSpec(compiler, spec);
    }
    else if (isKeywordValueProcessorSpec(spec)) {
      valueProcessor = this.compileKeywordValueProcessorSpec(compiler, spec, recursive);
    }
    else if (spec instanceof Executor) {
      valueProcessor = new ComposedValueProcessor(spec, spec);
    }
    else if (spec instanceof RegExp) {
      valueProcessor = new ComposedValueProcessor(new ConstantExecutor(spec), spec, `${spec}`);
    }
    else if (typeof spec === 'string' && spec.startsWith('/') && spec.lastIndexOf('/') > 0) {
      const lastSlash = spec.lastIndexOf('/');
      try {
        const regex = new RegExp(spec.slice(1, lastSlash), spec.slice(lastSlash + 1));
        valueProcessor = new ComposedValueProcessor(new ConstantExecutor(regex), regex, `${regex}`);
      }
      catch {
        throw new SchemaError(`Invalid regex pattern`, {value: spec});
      }
    }
    else if (spec instanceof SchemaCompiler) {
      valueProcessor = new ComposedValueProcessor(new ConstantExecutor(spec), spec);
    }
    else if (typeof spec === 'object' && typeof spec.process === 'function') {
      valueProcessor = new DefinedValueProcessor(spec);
    }
    else if (typeof spec === 'function') {
      valueProcessor = new FunctionValueProcessor(spec);
    }
    else if (Array.isArray(spec)) {
      valueProcessor = this.compileValueProcessorSpecArray(compiler, spec, recursive);
    }
    else if (typeof spec === 'object') {
      valueProcessor = this.compileValueProcessorSpecObject(compiler, spec, recursive);
    }
    else {
      valueProcessor = new ComposedValueProcessor(toExecutor(spec), spec)
    }
    if (valueProcessor.spec === undefined) {
      valueProcessor.spec = spec;
    }

    return valueProcessor;
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
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @param {boolean} [recursive]
   * @returns {Schema|CompiledSchema}
   */
  resolve(inputSchema, recursive = true) {
    if (inputSchema instanceof CompiledSchema) {
      return inputSchema;
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


}