//import { Buffer } from 'node:buffer';
import { CompiledSchema } from './compiled-schema.js';
import { Schema} from './schema.js';
import {
  ConfiguratorError,
  SchemaError,
  ConstraintError,
  ResolverError
} from '../errors.js';
import { deepValue, toKebabCase } from '../utils.js';
import { findDiscriminatorProperties, generateDiscriminatorFunction } from './helpers/union-helpers.js';

import { ANY_SCHEMA } from './builtin-schemas/any-schema.js';
import { STRING_SCHEMA } from './builtin-schemas/string-schema.js';
import { NUMBER_SCHEMA } from './builtin-schemas/number-schema.js';
import { BOOLEAN_SCHEMA } from './builtin-schemas/boolean-schema.js';
import { OBJECT_SCHEMA } from './builtin-schemas/object-schema.js';
import { ARRAY_SCHEMA } from './builtin-schemas/array-schema.js';
import { DATE_SCHEMA } from './builtin-schemas/date-schema.js';
import { BUFFER_SCHEMA } from './builtin-schemas/buffer-schema.js';
import { FUNCTION_SCHEMA } from './builtin-schemas/function-schema.js';
import { SIMPLE_PROCESSORS, PARAMETERIZED_PROCESSORS } from './builtin-processors/index.js';
import { ROOT_SCHEMA } from './builtin-schemas/root-schema.js';
/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueProcessor, AsyncSchemaValueProcessor, ValueProcessorDefinition, ProcessorSpecCompiler, CompiledSpec, CompiledValueProcessorDefinition, ProcessorSpec, ValueProcessorBuilder } from './types.js' */

export class SchemaResolver
{
  constructor() {
    /** @type {Map<string,Schema>} */
    this.schemaMap = new Map();

    /** @type {Map<string,ValueProcessorDefinition>} */
    this.processorMap = new Map();
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
    this.schemaMap.set(registryName, schema);
    return this;
  }

  /**
   * return the registered schema with a given name
   * @param {string} name
   * @returns {Schema}
   */
  getSchema(name) {
    const registryName = toKebabCase(name);
    const schema = this.schemaMap.get(registryName);
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
    return this.schemaMap.has(registryName);
  }

  /**
   * register a named "simple" ValueProcessor
   * @param {string} keyword
   * @param {SchemaValueProcessor<any>} processorFn
   * @param {() => string} [describeFn]
   * @returns {SchemaResolver}
   */
  registerValueProcessor(keyword, processorFn, describeFn) {
    if (typeof processorFn !== 'function') {
      throw new ResolverError(`Processor for keyword '${keyword}' must be a function`);
    }
    this.processorMap.set(keyword, {
      process: processorFn,
      describe: describeFn ?? (() => keyword)
    });
    return this;
  }

  /**
   * register a complex ValueProcessor that needs to be built based on schema processor spec
   * @param {string} keyword
   * @param {ValueProcessorBuilder} buildFn
   * @returns {SchemaResolver}
   */
  registerParameterizedValueProcessor(keyword, buildFn) {
    if (typeof buildFn !== 'function') {
      throw new ResolverError(`Processor builder for keyword '${keyword}' must be a function`);
    }
    this.processorMap.set(keyword, {
      build: buildFn
    })
    return this;
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
    // Register all simple processors
    for (const [keyword, processor] of SIMPLE_PROCESSORS) {
      this.registerValueProcessor(keyword, processor.process, processor.describe);
    }

    // Register all parameterized processors
    for (const [keyword, processor] of PARAMETERIZED_PROCESSORS) {
      if (processor.build !== undefined) {
        this.registerParameterizedValueProcessor(keyword, processor.build);
      }
      else {
        throw new ResolverError(`Parameterized processor for keyword '${keyword}' has no builder` );
      }
    }
  }

  /**
   * Wrap or convert a user-provided processor specification into a processor function
   * @param {ProcessorSpec} spec - The processor specification
   * @returns {CompiledValueProcessorDefinition}
   */
  _compileProcessorSpec(spec) {
    if (!spec) {
      return {
        processor: async (value) => value,
//        description: 'any'
      }
    }

    if (typeof spec === 'function') {
      return {
        processor: async (v, c, s, p, o) => spec(v, c, s, p, o), // Already a function - wrap to ensure it's async
        description: undefined
      }
    }

    // Regular expression object
    if (spec instanceof RegExp) {
      return {
        processor: async (value) => {
          if (!spec.test(String(value))) {
            throw new ConstraintError(`Value does not match pattern ${spec}`);
          }
          return value;
        },
        description: spec.toString()
      };
    }

    // String handling
    if (typeof spec === 'string') {

      if (spec.startsWith('/') && spec.lastIndexOf('/') > 0) {
        // String regex pattern "/pattern/flags"
        const lastSlash = spec.lastIndexOf('/');
        const pattern = spec.slice(1, lastSlash);
        const flags = spec.slice(lastSlash + 1);

        try {
          const regex = new RegExp(pattern, flags);
          return {
            processor: async (value) => {
              if (!regex.test(String(value))) {
                throw new ConstraintError(`Value does not match pattern ${spec}`);
              }
              return value;
            },
            description: spec
          }
        } catch (error) {
          throw new ResolverError(`Invalid regex pattern: ${spec}`);
        }
      }

      if (spec.startsWith('$')) {
        const keyword = spec.slice(1);
        const registered = this.processorMap.get(keyword);

        if (!registered) {
          throw new ResolverError(`Unknown processor keyword: ${spec}`);
        }

       return {
          processor: async (v,c,s,p,o) => registered.process?.(v,c,s,p,o),
          description: registered.describe?.()
        }
      }

      // Plain string - treat as exact match
      return {
        processor: async (value) => {
          if (String(value) !== spec) {
            throw new ConstraintError(`Value must be exactly "${spec}"`);
          }
          return value;
        },
        description: `"${spec}"`
      }
    }

    if (typeof spec === 'object') {
      //return this._compileObjectValidator(spec);

      const keys = Object.keys(spec);
      if (keys.length !== 1) {
        throw new ResolverError('Processor object must have exactly one key');
      }

      const [keyword] = keys;
      const keywordName = keyword.startsWith('$') ? keyword.slice(1) : keyword;
      const args = spec[keyword];

      const registered = this.processorMap.get(keywordName);

      if (!registered) {
        throw new ResolverError(`Unknown processor keyword: ${keyword}`);
      }

      if (registered.build) {
        // Parameterized validator - pass args and recursive compiler
        return registered.build(args, (spec) => this._compileProcessorSpec(spec));
      } else {
        throw new ResolverError(`Processor ${keyword} does not accept arguments`);
      }

    }
    throw new ResolverError(`Invalid processor specification: ${spec}`);

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
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @param {Schema} [parent]
   * @param {string} [name]
   * @returns {Schema}
   * @private
   */
  _resolve(inputSchema, parent, name) {
    const outputSchema = new Schema();

    /** @type {Schema|CompiledSchema|SchemaData|undefined} */
    let source = inputSchema;

    let strictCompileError;

    let foundAny = false;

    while (source !== undefined) {
      for (const [propName, propSchema] of Object.entries(source.properties ?? {})) {
        if (!outputSchema.properties.hasOwnProperty(propName)) {
          outputSchema.properties[propName] = this._resolve(propSchema, outputSchema, propName);
        }
      }
      for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
        if (!outputSchema.metadata.hasOwnProperty(metaName)) {
          outputSchema.metadata[metaName] = metaValue;
        }
      }
      for (const [discriminatorValue, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
        if (!outputSchema.unionSchemas.hasOwnProperty(discriminatorValue)) {
          outputSchema.unionSchemas[discriminatorValue] = this._resolve(unionSchema, parent, name);
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
          let handlerName = `${optionName}s`;
          if (!outputSchema.handlers.hasOwnProperty(handlerName)) {
            outputSchema.handlers[handlerName] = [];
          }
          outputSchema.handlers[handlerName].unshift(optionValue);
//          throw new Error('LEGACY');
        }
        if (!outputSchema.options.hasOwnProperty(optionName)) {
          outputSchema.options[optionName] = optionValue;
        }
      }
      if (source instanceof CompiledSchema) {
        source = undefined;
      }
      else {
        if (source.base === undefined && !foundAny) {
          source.base = 'any';
        }
        foundAny = (source.base === 'any');

        if (source.base) {
          if (this.hasSchema(source.base)) {
            source = this.getSchema(source.base);
          }
          else {
            // base schema is undefined; this is only an error if you actually try to use it
            // allow error to be omitted if the schema is marked "lax"
            const base = `${source.base}`

            strictCompileError = new ResolverError(`Unable to resolve "${base}"`)
            outputSchema.options.transformer = ((value, config, schema) => {
              if (schema.options.strict !== false) {
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
    if (!(inputSchema instanceof CompiledSchema) && inputSchema.base && !outputSchema._metadata.parserTypeHint) {
      outputSchema.metadata.parserTypeHint = inputSchema.base;
    }
    if (outputSchema.options.strict !== false && strictCompileError) {
      throw strictCompileError;
    }
    return outputSchema;
  }

  /**
   * @param {Schema|SchemaData} inputSchema
   * @param {CompiledSchema} [parent] - parent schema (if attached)
   * @param {string} [name]               - property name in parent (if attached)
   * @returns {Promise<CompiledSchema>}
   * @private
   */
  async _compile(inputSchema, parent, name) {

    const outputSchema = new CompiledSchema(CompiledSchema.__TOKEN, parent, name);
    if (!inputSchema.base) {
// fixme?      inputSchema.base = 'any';
    }

    const source = this._resolve(inputSchema);

    for (const [propName, propSchema] of Object.entries(source.properties ?? {})) {
      outputSchema.properties[propName] = await this._compile(propSchema, outputSchema, propName);
    }
    for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
      outputSchema.metadata[metaName] = metaValue;
    }
    for (const [discriminatorValue, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
      outputSchema.unionSchemas[discriminatorValue] = await this._compile(unionSchema, parent, name);
    }

    // first pass over the defined options
    await this._compileOptions({normalizer: undefined, ...source.options}, outputSchema);

    if (outputSchema.options.compileHook && typeof outputSchema.options.compileHook === 'function') {
      outputSchema.options.compileHook('compile', outputSchema);
    }
    return outputSchema;
  }

    /**
     *
     * @param {CompiledSchema} schema
     * @returns {string}
     * @private
     */
    static _formatArgumentType(schema) {

      if (schema.metadata.valueDescription) {
        return schema.metadata.valueDescription;
      }

      let argumentTypeString;
      if (schema.isArray && schema.hasChildren) {
        let props = Object.keys(schema.properties)
                          .sort((a, b) => {
                            if (a === '*') return 1;
                            if (b === '*') return -1;
                            return a.localeCompare(b, undefined, {numeric: true});
                          })
                          .map(k => schema.properties[k]);

        argumentTypeString = props.map(s => SchemaResolver._formatArgumentType(s)).join(', ')

        if (schema.properties['*']) {
          argumentTypeString += '...';
        }

        if (schema.metadata.validatorDescription) {
          if (argumentTypeString && !argumentTypeString.includes(schema.metadata.validatorDescription)) {
            argumentTypeString += ` {${schema.metadata.validatorDescription}}`;
          }
        }
      }
      else {
        if (Array.isArray(schema.options.values) && schema.options.values.length > 0) {
          argumentTypeString = schema.options.values.map(v => `${v}`)
                                     .sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).join('|');
        }
        else {
          argumentTypeString = schema.metadata.valueName ?? (schema.isArray? '' : schema.options.type);

          if (schema.metadata.validatorDescription) {
            if (!argumentTypeString || (argumentTypeString === schema.options.type)) {
              argumentTypeString = schema.metadata.validatorDescription;  // overwrite basic "type names"
            }
            else {
              argumentTypeString = `${argumentTypeString} {${schema.metadata.validatorDescription}}`;
            }
          }
        }
        if (argumentTypeString === undefined) {
          argumentTypeString = 'value';
        }
        if (schema.isArray && !argumentTypeString.includes('...')) {
          argumentTypeString += '...';
        }
      }
      return argumentTypeString;
    }

  /**
   * @param {CompiledSchema} schema
   * @returns {Promise<CompiledSchema>}
   * @private
   */
  async _finalize(schema) {
    for (const propSchema of Object.values(schema.properties)) {
      await this._finalize(propSchema);
    }
    for (const unionSchema of Object.values(schema.unionSchemas)) {
      await this._finalize(unionSchema);
    }
    // second pass runs every compiler to ensure that any required options are set up
    await this._compileOptions(undefined, schema);

    if (!schema.metadata.valueDescription) {
      const valueDescription = SchemaResolver._formatArgumentType(schema);
      if (schema.parent?.isArray) {
        schema.metadata.valueDescription = valueDescription;
      }
      else {
        schema.metadata.valueDescription = schema.required ? `<${valueDescription}>` : `[${valueDescription}]`;
      }
    }
    if (!schema.metadata.valueName) {
      schema.metadata.valueName = schema.metadata.parserTypeHint ?? 'value';
    }

    const p = schema.path ? ` at "${schema.path}"` : ``;

    if (schema.isUnion && schema.options.discriminator === undefined) {
      throw new ConfiguratorError(`Union schema${p} needs a discriminator defined`);
    }

    if (schema.hasChildren && schema.options.type !== 'object' && schema.options.type !== 'array' && schema.options.type !== 'any') {
      throw new ConfiguratorError(`Schema${p} has children defined but is not a container`);
    }

    if (schema.options.compileHook && typeof schema.options.compileHook === 'function') {
      schema.options.compileHook('finalize', schema);
    }
    return schema;
  }

  /**
   * @template TReturn
   * @param {SchemaValueProcessor<TReturn>|TReturn} fn
   * @param {TReturn} [d]
   * @returns {SchemaValueProcessor<TReturn>}
   * @private
   */
  _svf(fn, d) {
    return (v, c, s, p, o) => {

      if (!s) {
        throw new ConfiguratorError('Invalid call to schema value function');  // developer error
      }
      c = c ?? {};
      p = p ?? s.path;
      o = o ?? {};

      if (!fn) {
        return v ?? d
      }
      if (typeof fn === 'function') {
        // @ts-ignore
        return fn(v, c, s, p, o);
      }
      return fn;
    }
  }

  /**
   * @template TReturn
   * @param {SchemaValueProcessor<TReturn>|TReturn} fn
   * @param {TReturn} [d]
   * @returns {AsyncSchemaValueProcessor<TReturn>}
   * @private
   */
  _asyncifySVF(fn, d) {
    return async (v, c, s, p, o) => {

      if (!s) {
        throw new ConfiguratorError('Invalid call to schema value function');  // developer error
      }
      c = c ?? {};
      p = p ?? s.path;
      o = o ?? {};

      if (!fn) {
        return v ?? d
      }
      if (typeof fn === 'function') {
        // @ts-ignore
        return fn(v, c, s, p, o);
      }
      return fn;
    }
  }


  /**
   *
   * @param {Object|undefined} options
   * @param {CompiledSchema} dst
   * @private
   */
  async _compileOptions(options, dst) {
    if (options === undefined) {
      // if we aren't passed options, we run all compilers passing undefined as the value
      options = Object.fromEntries(Object.keys(this._compilers).map(c => [c, undefined]));
    }
    let maxPhase = 0;
    let phase = 0;

    while (phase <= maxPhase) {
      for (const [optionName, optionValue] of Object.entries(options)) {
        const compiler = this._compilers[optionName] ?? this._compilers['*'];
        const compilerPhase = compiler.phase ?? 0;

        if (compilerPhase > maxPhase) {
          maxPhase = compilerPhase;
        }
        if (phase === compilerPhase) {
          await compiler.exec(optionName, optionValue, dst);
        }
      }
      phase++;
    }
  }
  /** @typedef {{exec: (option:string|undefined, value:any, dst:CompiledSchema) => Promise<void>, phase?: number}} OptionCompiler */
  /** @type {Object.<string,OptionCompiler>} */
  _compilers = {
    '*': {
      exec: async (option, value, dst) => {
        if (option && value !== undefined && dst.options[option] === undefined) {
          dst.options[option] = value;
        }
      },
      phase: 0
    },
    'values': {
      exec: async (option, values, dst) => {
        if (values !== undefined && !Array.isArray(values)) {
          values = [values];
        }
        if (values && dst.hasChildren) {
          // child properties are assigned incrementally, so complex object values would never match
          throw new SchemaError(`Cannot set values for an schema with child properties`);
        }

        if (!dst.options.values) {
          if (values) {
            dst.options.values = [];  // we set the array first because some normalizers may change behavior if the schema has a value
            for (const v of values) {
              dst.options.values.push(await dst.normalize(v, {}, dst.path));
            }
          }
          else {
            if (dst.options.selector) {
              if (dst.parent === undefined) {
                throw new SchemaError(`Cannot synthesize values for an invalid selector`);
              }
              const v = new Set();

              for (const propName in dst.parent.properties) {
                const propSchema = dst.parent.properties[propName];
                if (propSchema.isSelection) {
                  v.add(await dst.normalize(typeof propSchema.options.selection === 'string'? propSchema.options.selection : propName));
                }
              }
              dst.options.values = Array.from(v);
            }
          }
        }
      },
      phase: 3
    },
    /*
    'selection': {
      exec: (option, value, dst) => {
        if (value && !dst.options.selection) {
          dst.options.selection = dst.normalize(value, {}, dst.path);  // this is wrong, selection just is a boolean marker!
        }
      },
      phase: 2
    },
     */
    'normalizer': {
      exec: async (option, value, dst) => {
        if (!dst.options.normalizer) {
          dst.options.normalizer = (this._asyncifySVF(value));
        }
      },
      phase: 1
    },
    'transformer': {
      exec: async (option, value, dst) => {
        if (!dst.options.transformer) {
          dst.options.transformer = this._asyncifySVF(value);
        }
      },
      phase: 1
    },
    'validator': {
      exec: async (option, value, dst) => {
        if (dst.options.validator) {
          return;
        }
        const c = this._compileProcessorSpec(value);
        dst.options.validator = c.processor;
        dst.metadata.validatorDescription = c.description ;

//        if (c.description && !dst.metadata.valueDescription) {
//          dst.metadata.valueDescription = c.description;
//        }

      },
      phase: 1
    },
    'serializer': {
      exec: async (option, value, dst) => {
        if (!dst.options.serializer) {
          dst.options.serializer = this._asyncifySVF(value);
        }
      },
      phase: 1
    },
    'condition': {
      exec: async (option, value, dst) => {
        if (dst.options.condition) {
          return;
        }
        if (value !== undefined) {
          dst.options.condition = this._asyncifySVF(value, true);
        }
        else if (dst.options.selection) {

          const rawSelectionValue =  (typeof dst.options.selection === 'string') ? dst.options.selection : dst.name;

          dst.options.condition = async (value, configuration, schema, path) => {
            const ldi = path.lastIndexOf('.');
            const parentPath = (ldi === -1) ? '' : path.substring(0, ldi);

            let parentSchema = schema.parent;

            for (let propName in parentSchema?.properties) {
              let s = parentSchema.properties[propName];

              if (s.isSelector) {
                const selectorPath = parentPath ? `${parentPath}.${propName}` : propName;
                const selectorValue = deepValue(configuration, selectorPath);
                return (await s.normalize(selectorValue)) === (await s.normalize(rawSelectionValue));
              }
            }
            return false;
          }
        }
        else {
          dst.options.condition = async () => true;
        }
      },
      phase: 4
    },
    'discriminator': {
      exec: async (option, value, dst) => {
        if (!value) {
          if (dst.isUnion && !dst.options.discriminator) {
            dst.options.discriminator = generateDiscriminatorFunction(dst);
            await this._hoistDiscriminatorProperties(dst);
          }
          return;  // there is no default discriminator
        }
        if (dst.options.discriminator) {
          return;
        }
        if (typeof value === 'function') {
          dst.options.discriminator = this._asyncifySVF(value);
        }
        else if (typeof value === 'string') {
          const propertyName = value;
          const ref = dst.properties[propertyName];
          if (!ref) {
            throw new SchemaError(`Discriminator property ${propertyName} not found`);
          }
          dst.options.discriminator = async input => {
            const rawDiscriminatorValue = input?.[propertyName];

            if (rawDiscriminatorValue === undefined) {
              return undefined;
            }
            let unionSchema = dst.unionSchemas[rawDiscriminatorValue];
            if (unionSchema !== undefined) {
              return unionSchema;
            }

            const discriminatorValue = await ref.normalize(rawDiscriminatorValue);
            unionSchema = dst.unionSchemas[discriminatorValue];

            if (unionSchema !== undefined) {
              return unionSchema;
            }
            for (const [unionSchemaKey, unionSchema] of Object.entries(dst.unionSchemas)) {
              if (await ref.normalize(unionSchemaKey) === discriminatorValue) {
                return unionSchema;
              }
            }
            return undefined;
          }
          if (!ref.options.values) {
            ref.options.values = [];
            for (const discriminatorKey in dst.unionSchemas) {
              ref.options.values.push(await ref.normalize(discriminatorKey));
            }
          }
        }
        else {
          throw new SchemaError('Invalid discriminator')
        }
      },
      phase: 4
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
      let values = new Set();

      /** @type {ProcessorSpec} */
      let normalizer;
      let normalizerCompatible = true;

      for (const unionSchema of schemaSet) {
        const propertySchema = unionSchema.properties[property];
        if (!propertySchema) {
          continue;
        }
        if (!normalizer) {
          normalizer = propertySchema.options.normalizer;
        }
        if (propertySchema.metadata.parserTypeHint) {
          if (base === undefined) {
            base = propertySchema.metadata.parserTypeHint;
          }
          else if (base && base !== propertySchema.metadata.parserTypeHint) {
            base = 'any';
            // Incompatible base types mean we can't use a shared normalizer
            normalizerCompatible = false;
          }
        }
        if (!Array.isArray(propertySchema.values)) {
          continue;
        }
        for (const v of propertySchema.values) {
          // Only check normalizer compatibility if we haven't already determined incompatibility
          if (normalizerCompatible && normalizer && await normalizer(v, {}, propertySchema, propertySchema.path) !== v) {
            // Normalizers are incompatible - will fall back to 'any' with no normalizer
            normalizerCompatible = false;
          }
          values.add(await propertySchema.normalize(v))  // aren't they already normalized?
          if (base === undefined) {
            if (this.hasSchema(typeof v)) {
              base = typeof v;
            }
          }
        }


      }

      // Use normalizer only if it's compatible across all union members
      const useNormalizer = normalizerCompatible && normalizer;

      if (!useNormalizer && base !== 'any') {
        throw new ConfiguratorError(`No compatible normalizer for common ${property} in union`)
      }
      // noinspection JSUnusedAssignment
      const hoisted = new Schema(base ?? 'any');
      if (useNormalizer) {
        hoisted.normalizer(normalizer);
      }
      if (values.size > 0) {
        hoisted.values(Array.from(values))
      }

      const compiledHoisted = await this._compile(hoisted, schema, property);
      await this._finalize(compiledHoisted);

      schema.properties[property] = compiledHoisted;
    }

  }
}

