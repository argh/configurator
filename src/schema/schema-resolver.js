import { CompiledSchema } from './compiled-schema.js';
import { Schema } from './schema.js';
import {
  ConfiguratorError,
  SchemaError,
  ConstraintError,
  ResolverError
} from '../errors.js';
import { toKebabCase } from '../utils.js';
import {
  findDiscriminatorProperties,
  generateAutomaticDiscriminatorFunction,
  generatePropertyValueDiscriminatorFunction
} from './helpers/union-helpers.js';

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
import { fpm, fpvm } from './helpers/fpm.js';
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
    const { keyword, processor, description, builder } = definition;

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
   * @private
   */
  _compileProcessorSpec(spec) {
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
            def = registered.builder(args, (spec) => this._compileProcessorSpec(spec));
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

      const compiled = this._compileProcessorSpec(def.spec);
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
          throw new ConstraintError(fpvm('Must have exact', spec));
        }
        return value;
      },
      description
    }
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
    const compiledSchema = await this._compile(inputSchema);
    await this._finalize(compiledSchema);
    compiledSchema.freeze();
    return compiledSchema;
  }

  /**
   * Create a new Schema that contains the flattened hierarchy of all resolved base schemas.
   *
   * This can be useful if you need to make changes to the full schema, e.g. prepending processors
   * before the base class handlers.
   *
   * @param {Schema|CompiledSchema|SchemaData|string} inputSchema
   * @returns {Schema}
   */
  resolve(inputSchema) {

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
          outputSchema.properties[propName] = this.resolve(propSchema);
        }
      }
      for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
        if (!outputSchema.metadata.hasOwnProperty(metaName)) {
          outputSchema.metadata[metaName] = metaValue;
        }
      }
      for (const [discriminatorValue, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
        if (!outputSchema.unionSchemas.hasOwnProperty(discriminatorValue)) {
          outputSchema.unionSchemas[discriminatorValue] = this.resolve(unionSchema);
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
        if (['normalizer', 'transformer', 'validator', 'serializer'].includes(optionName)) {
          // todo - legacy, remove!
          throw new Error('FIXME');
        }
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
            outputSchema.normalizer((value, config, location) => {
              if (location.schema.strict !== false) {
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
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @param {string} [path]
   * @returns {Promise<CompiledSchema>}
   * @private
   */
  async _compile(inputSchema, path = '') {

    if (inputSchema instanceof CompiledSchema) {
      return inputSchema;
    }
    if (this.#compilationCache.has(inputSchema)) {
      return this.#compilationCache.get(inputSchema);
    }

    const outputSchema = new CompiledSchema(CompiledSchema.__TOKEN);

    this.#compilationCache.set(inputSchema, outputSchema);

    const source = this.resolve(inputSchema);

    runCompileHook('resolve', source, path);

    for (const [propName, propSchema] of Object.entries(source.properties ?? {})) {
      const propertyPath = path? `${path}.${propName}` : propName;
      outputSchema.properties[propName] = await this._compile(propSchema, propertyPath);
    }
    for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
      outputSchema.metadata[metaName] = metaValue;
    }
    for (const [unionKey, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
      // todo - restore support for union-keyed path elements?
      outputSchema.unionSchemas[unionKey] = await this._compile(unionSchema, path);
    }

    runCompileHook('link', source, path)

    const specialOptions = ['values' /*, 'default'*/];

    for (const [optionName, optionValue] of Object.entries(source.options ?? {})) {
      if (specialOptions.includes(optionName)) {
        continue;
      }
      outputSchema.options[optionName] = optionValue;
    }

    await this._compileNormalizers(source, outputSchema, path);
    await this._compileValues(source, outputSchema, path);  // performs normalization!
    await this._compileConditions(source, outputSchema, path);
    await this._compileTransformers(source, outputSchema, path);
    await this._compileValidators(source, outputSchema, path);
    await this._compileSerializers(source, outputSchema, path);
    await this._compileDiscriminator(source, outputSchema, path);

    runCompileHook('compile', outputSchema, path);

    return outputSchema;
  }



  /**
   * @param {CompiledSchema} schema
   * @param {string} [path]
   * @param {CompiledSchema} [parent]
   * @returns {Promise<CompiledSchema>}
   * @private
   */
  async _finalize(schema, path = '', parent) {

    if (this.#finalizationSet.has(schema)) {
      return schema;
    }
    this.#finalizationSet.add(schema);
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      await this._finalize(propSchema, propPath, schema);
    }
    for (const unionSchema of Object.values(schema.unionSchemas)) {

      const skipOptions = ['values', 'type', 'default'];

      for (const [optionName, optionValue] of Object.entries(schema.options ?? {})) {
        if (skipOptions.includes(optionName)) {
          continue;
        }
        if (optionValue !== undefined && unionSchema.options[optionName] === undefined) {
          // union schemas "inherit" options from their parent
          unionSchema.options[optionName] = optionValue;
        }
      }

      await this._finalize(unionSchema, path, parent);
    }
    await this._finalizeValues(schema, parent);
    await this._finalizeMetadata(schema);

    if (schema.isUnion && !schema.handlers.discriminators) {
      throw new SchemaError(fpm(`No discriminator defined for union`, path));
    }

    if (schema.hasChildren && schema.options.type !== 'object' && schema.options.type !== 'array' && schema.options.type !== 'any') {
      throw new SchemaError(fpm(`Schema defines child properties but does not identify as a container`, path));
    }

    if (schema.isUnion && schema.hasWildcard) {
      throw new SchemaError(fpm(`Wildcard properties cannot be set on a union`, path));
    }

    if (schema.hasChildSelector !== schema.hasChildSelection) {
      throw new SchemaError(fpm(`Inconsistently defined selector/selections in properties`, path));
    }

    runCompileHook('finalize', schema, path);

    return schema;
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


  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @param {string} handlerName
   * @param {string} [descriptionMetadata];
   * @returns {Promise<void>}
   * @private
   */
  async _compileHandler(src, dst, path, handlerName, descriptionMetadata) {
    if (dst.handlers[handlerName] !== undefined) {
      return;
    }

    const specList = src.handlers[handlerName] ?? [];

    if (!Array.isArray(specList)) {
      throw new SchemaError(`Invalid ${handlerName} definition in ${path ? path : 'root'} schema`);
    }
    if (specList.length === 0) {
      return;
    }

    const compiledDefinition = this._compileProcessorSpec(specList);

    dst.handlers[handlerName] = [compiledDefinition];

    if (descriptionMetadata && !dst.metadata[descriptionMetadata] && compiledDefinition.description) {
      dst.metadata[descriptionMetadata] = compiledDefinition.description;
    }
  }

  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileNormalizers(src, dst, path) {
    await this._compileHandler(src, dst, path, 'normalizers', 'normalizerDescription');
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileTransformers(src, dst, path) {
    await this._compileHandler(src, dst, path, 'transformers', 'transformerDescription');
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileConditions(src, dst, path) {
    await this._compileHandler(src, dst, path, 'conditions', 'conditionDescription');
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileValidators(src, dst, path) {
    await this._compileHandler(src, dst, path, 'validators', 'validatorDescription');
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileSerializers(src, dst, path) {
    await this._compileHandler(src, dst, path, 'serializers', 'serializerDescription');
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileDiscriminator(src, dst, path) {
    if (!dst.isUnion || dst.handlers.discriminators) {
      return;
    }
    if (src.handlers.discriminators) {
      await this._compileHandler(src, dst, path, 'discriminators', 'discriminatorDescription');
      return;
    }
    const unionKeyProperty = Object.entries(dst.properties).find(e => e[1].isUnionKey);
    if (unionKeyProperty) {
      // Note: it's ok to use a custom discriminator (above) even if there is a union key option,
      // as it also triggers population of allowed values for the property in _finalizeValues.
      dst.handlers.discriminators = [
        this._compileProcessorSpec(generatePropertyValueDiscriminatorFunction(dst, unionKeyProperty[0]))
      ];
    }
    else {
      await this._hoistDiscriminatorProperties(dst);
      dst.handlers.discriminators = [
        this._compileProcessorSpec(generateAutomaticDiscriminatorFunction(dst))
      ];
    }
  }
  /**
   * @param {Schema} src
   * @param {CompiledSchema} dst
   * @param {string} path
   * @returns {Promise<void>}
   * @private
   */
  async _compileValues(src, dst, path) {
    if (dst.options.values !== undefined || src.options.values === undefined) {
      return;
    }
    if (!Array.isArray(src.options.values)) {
      throw new SchemaError('Schema values option is not an array');
    }
    dst.options.values = [];
    for (const value of src.options.values) {
      dst.options.values.push(await dst._normalizeValue(value));
    }
  }

  /**
   *
   * @param {CompiledSchema} dst
   * @param {CompiledSchema} [parent]
   * @returns {Promise<void>}
   * @private
   */
  async _finalizeValues(dst, parent) {
    if (dst.options.values !== undefined) {
      // todo - maybe throw an exception if we needed to synthesize values but it was already defined?
      return;
    }
    if (dst.isSelector && dst.isUnionKey) {
      throw new SchemaError('Cannot populate values for a schema that is both a selector and a union key')
    }
    const v = new Set();
    if (dst.isUnionKey) {
      if (!parent?.isUnion) {
        throw new SchemaError('Cannot populate values for a union key property without a parent union')
      }
      for (const key in parent.unionSchemas) {
        v.add(await dst._normalizeValue(key));
      }
    }
    if (dst.isSelector) {
      if (parent === undefined) {
        throw new SchemaError(`Cannot populate values for a detached selector schema`);
      }

      if (!parent.hasChildSelection) {
        throw new SchemaError(`Cannot populate values for a selector if the parent has no selections`);
      }

      for (const propName in parent.properties) {
        const propSchema = parent.properties[propName];
        if (propSchema.isSelection) {
          const selectionValue = (propSchema.selection === true)? propName : propSchema.selection;
          v.add(await dst._normalizeValue(selectionValue));
        }
      }
    }
    if (v.size > 0) {
      // Only add a value constraint if we successfully determined some values.
      dst.options.values = Array.from(v);
    }
  }
  async _finalizeMetadata(schema) {
    if (!schema.metadata.valueDescription) {
      const valueDescription = formatArgumentType(schema);
      schema.metadata.valueDescription = schema.required ? `<${valueDescription}>` : `[${valueDescription}]`;
    }
    if (!schema.metadata.valueName) {
      schema.metadata.valueName = schema.metadata.parserTypeHint ?? 'value';
    }
  }

  /**
   *
   * @param {CompiledSchema} schema
   * @private
   */
  async _hoistDiscriminatorProperties(schema) {
    if (!schema.isUnion) {
      throw new ConfiguratorError('Can only hoist discriminator properties for a union');
    }
    const discriminatorPropertyMap = findDiscriminatorProperties(Object.values(schema.unionSchemas));

    for (const [property, schemaSet] of discriminatorPropertyMap) {
      if (schema.properties[property]) {
        continue;
      }

      if (schemaSet.size === 1) {
        const [unionSchema] = schemaSet;
        const propertySchema = unionSchema.properties[property];
        if (propertySchema) {
          // this feels dangerous...
          schema.properties[property] = propertySchema;
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
        if (!Array.isArray(propertySchema.values)) {
          continue;
        }
        for (const v of propertySchema.values) {
          const normalized = await propertySchema._normalizeValue(v);
          if (normalizerCompatible && normalized !== v) {
            normalizerCompatible = false;
          }
          values.add(normalized);
          if (base === undefined) {
            if (this.hasSchema(typeof v)) {
              base = typeof v;
            }
          }
        }

      }

      const useNormalizer = normalizerCompatible && firstNormalizers;

      const hoisted = new Schema(base ?? 'any');
      if (useNormalizer && firstNormalizers) {
        for (const normalizer of firstNormalizers) {
          hoisted.normalizer(normalizer);
        }
      }
      if (values.size > 0) {
        hoisted.values(Array.from(values))
      }

      const compiledHoisted = await this._compile(hoisted, property);
      await this._finalize(compiledHoisted);

      schema.properties[property] = compiledHoisted;
    }

  }
}

/**
 * @param {string} hookName
 * @param {import('./schema.js').ISchema} schema
 * @param {string} path
 * @private
 */
function runCompileHook(hookName, schema, path) {
  try {
    const hookFunction = schema.options.compileHook;

    if (typeof hookFunction !== 'function') {
      return;
    }
    hookFunction(hookName, schema);
  }
  catch (error) {
    throw new SchemaError(fpm(`Compilation error: ${error.message}`, path));
  }
}