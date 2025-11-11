//import { Buffer } from 'node:buffer';
import * as fs from 'node:fs/promises';
import { CompiledSchema } from './compiled-schema.js';
import { Schema} from './schema.js';
import {
  ConfiguratorError,
  NormalizeError,
  SchemaError,
  SerializeError,
  TransformError,
  ValidationError
} from '../errors.js';
import { constants } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { deepValue, toKebabCase } from '../utils.js';
import { findDiscriminatorProperties, generateDiscriminatorFunction } from './helpers/union-helpers.js';
import { parse, stringify } from './helpers/stringify.js';
import { parseDate } from './helpers/parse-date.js';
/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueFunction, AsyncSchemaValueFunction } from './types.js' */
/** @import { CompiledSchemaMetadata, CompiledSchemaOptions } from './compiled-schema.js'; */

// typedef {import("./compiled-schema.js").CompiledSchemaOptions} CompiledSchemaOptions
/** @typedef {(spec:any) => CompiledSchemaOptions} ValidatorSpecCompiler */

/**
 * @typedef {Object} ValidatorDefinition
 * @property {SchemaValueFunction<any>|null} validate
 * @property {(() => string)|null} describe
 * @property {((args:any, compileSpec:ValidatorSpecCompiler) => CompiledSchemaOptions)|null} compile - The validator specification
 */

export class SchemaResolver
{
  constructor() {
    /** @type {Map<string,Schema>} */
    this.schemaMap = new Map();

    /** @type {Map<string,ValidatorDefinition>} */
    this.validatorMap = new Map();
    this._registerBuiltins();
    this._registerBuiltInValidators()
  }

  /**
   * associate a schema with a
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
   * register a named simple validator
   * @param {string} keyword
   * @param {SchemaValueFunction<any>} validatorFn
   * @param {() => string} [describeFn]
   * @returns {SchemaResolver}
   */
  registerValidator(keyword, validatorFn, describeFn) {
    if (typeof validatorFn !== 'function') {
      throw new ResolverError(`Validator for keyword '${keyword}' must be a function`);
    }
    this.validatorMap.set(keyword, {
      validate: validatorFn,
      describe: describeFn ?? (() => keyword),
      compile: null
    });
    return this;
  }

  /**
   * register a complex validator that needs to be compiled based on schema validator spec
   * @param {string} keyword
   * @param {(args:any, specCompiler:ValidatorSpecCompiler)=> CompiledSchemaOptions} compileFn
   * @returns {SchemaResolver}
   */
  registerParameterizedValidator(keyword, compileFn) {
    this.validatorMap.set(keyword, {
      validate: null,
      describe: null,
      compile: compileFn
    })
    return this;
  }

  /**
   * @private
   */
  _registerBuiltins() {
    this.registerSchema('root-schema', new Schema()
      .default(true)
      .meta('hidden')
      .meta('internal')
      .meta('omitFromSerialize')
      .normalizer(() => 'root-schema')
      .transformer((_v, _c, schema) => {
        while (schema?.parent) {
          schema = schema.parent;
        }
        return schema;
      })
      .serializer((_v, _c, schema) => {
        while (schema?.parent) {
          schema = schema.parent;
        }
        return schema.toData();
      })
    );

    this.registerSchema('any', new Schema()
      .option('type', 'any')
      .normalizer((value, _, schema) => {
        if (value === true) {
          const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

          if (hasChildren) {
            let check = s => Object.keys(s.properties).some(k => !/^[\d*]/.test(k));

            let hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

            return hasStringProps ? {} : [];
          }
        }
        return value;
      })
      .transformer((value, _, schema) => {
        if (value === true) {
          const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

          if (hasChildren) {
            let check = s => Object.keys(s.properties).some(k => !/^[\d*]/.test(k));

            let hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

            return hasStringProps ? {} : [];
          }
        }
        return value;
      })
    );

    this.registerSchema('string', new Schema()
      .option('type', 'string')
      .meta('valueName', 'string')
      .normalizer((value) => String(value))
      .validator((value) => {
        if (typeof value !== 'string') {
          throw new ValidationError('Not a string');
        }
        return value;
      })
    );

    this.registerSchema('number', new Schema()
      .option('type', 'number')
      .meta('valueName', 'number')
      .normalizer((value) => {
        if (typeof value === 'number') return value;
        const num = Number(value);
        if (isNaN(num)) throw new NormalizeError(`Invalid number: ${value}`);
        return num;
      })
      .validator((value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        throw new ValidationError(`Invalid number: "${value}`);
      })
    );

    this.registerSchema('boolean', new Schema()
      .option('type', 'boolean')
      .meta('valueName', 'boolean')
      .validator({$in: [true, false]})
      .normalizer((value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1' || lower === 'yes') return true;
          if (lower === 'false' || lower === '0' || lower === 'no') return false;
        }
        return Boolean(value);
      })
    );

    this.registerSchema('object', new Schema()
      .option('type', 'object')
      .meta('valueName', 'object')
      .normalizer((value, _, schema) => {
        if (value === true) {
          value = {};
        }
        if (typeof value === 'string') {
          // otherwise, we normalize as an object
          try {
            value = parse(value);
          }
          catch (error) {
            throw new NormalizeError(`Invalid serialized object: ${value}`, {cause: error});
          }
        }
        if (typeof value === 'object') {
          // if we need to be able to compare this value, it needs to be normalized as a string
          return Array.isArray(schema.values)? stringify(value) : value
        }
        throw new NormalizeError(`Invalid object value: ${value}`);
      })
      .transformer((value) => {
        if (value === true) {
          value = {};
        }
        if (typeof value === 'string') {
          try {
            value = parse(value.trim());
          }
          catch (error) {
            throw new TransformError(`Invalid serialized object: ${value}`, {cause: error});
          }
        }
        if (typeof value === 'object') {
          return value;
        }
        throw new TransformError(`Invalid object value: ${value}`)
      })
      .validator((value) => {
        if (typeof value !== 'object') {
          throw new ValidationError(`Invalid object: "${value}"`)
        }
        // NOTE: we let the schema validate object children; this should be used for specialization
        return value;
      })
    );

    this.registerSchema('array', new Schema()
      .option('type', 'array')
      .normalizer((value, _, schema) => {
        if (value === true) {
          value = [];
        }
        else if (value === '*' && schema.properties['*']?.values?.length) {
          value = [...schema.properties['*'].values];
        }
        if (typeof value === 'string') {
          value = value.trim();
          if (value.length > 0 && value[0] === '[' && value[value.length - 1] === ']') {
            try {
              value = parse(value);
            }
            catch (error) {
              throw new NormalizeError(`Invalid serialized array: ${value}`);
            }
          }
          else {
            value = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        }
        if (Array.isArray(value)) {
          // if we need to be able to compare this value, it needs to be normalized as a string
          return (Array.isArray(schema.values)? stringify(value) : value);
        }
        throw new NormalizeError(`Invalid array value: ${value}`)
      })
      .transformer((value, _, schema) => {
        if (value === true) {
          value = [];
        }
        else if (value === '*' && schema.properties['*']?.values?.length) {
          value = [...schema.properties['*'].values];
        }
        if (typeof value === 'string') {
          value = value.trim();
          try {
            value = parse(value);
          }
          catch (error) {
            throw new TransformError(`Invalid serialized array: ${value}`, {cause: error});
          }
        }
        if (Array.isArray(value)) {
          return value;
        }
        throw new TransformError(`Invalid array value ${value}`);
      })
      .validator((value) => {
        if (!Array.isArray(value)) {
          throw new ValidationError(`Invalid array "${value}"`)
        }
        // NOTE: we let the schema validate array elements; this should be used for specialization
        return value;
      })
    );
    this.registerSchema('date', new Schema()
      .option('type', 'date')
      .meta('parserTypeHint', 'string')
      .meta('valueName', 'date')
      .meta('valueDescription', 'ms|iso date|"now"|[+|-]offset[d|h|m|s|ms]')
      .transformer(parseDate)
      .validator((value) => {
        if (value instanceof Date && !isNaN(value.getTime())) {
          return value;
        }
        throw new ValidationError('Invalid date value')
      })
      .serializer((value) => {
        if (!(value instanceof Date)) {
          throw new SerializeError(`Expected Date object for serializing, got ${typeof value}`);
        }
        return value.toISOString();
      })
    );
    this.registerSchema('buffer', new Schema()
      .option('type', 'buffer')
      .meta('parserTypeHint', 'string')
      .transformer((value) => {
        try {
          if (typeof value === 'string') {
            return Buffer.from(value, 'base64');
          }
          else {
            return Buffer.from(value);
          }
        }
        catch (error) {
          throw new TransformError(`Invalid buffer value: ${value}`, {cause: error});
        }
      })
      .serializer((value) => {
        if (Buffer.isBuffer(value)) {
          return value.toString('base64');
        }
        else {
          return undefined;
        }
      })
    );
  }

  /**
   * @private
   */
  _registerBuiltInValidators() {
    // Synchronous validators
    this.registerValidator('hostname', (value) => {
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

      if (!hostnameRegex.test(value)) {
        throw new ValidationError('Invalid hostname format');
      }
      return value;
    });

    this.registerValidator('url', (value) => {
      try {
        return new URL(value).toString();
      } catch {
        throw new ValidationError('Invalid URL format');
      }
    });

    this.registerValidator('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new ValidationError('Invalid email format');
      }
      return value;
    });

    this.registerValidator('port', (value) => {
      const num = Number(value);
      if (!(Number.isInteger(num) && num >= 1 && num <= 65535)) {
        throw new ValidationError('Port must be between 1 and 65535');
      }
      return num;
    });

    this.registerValidator('ipv4', (value) => {
      const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
      if (!ipv4Regex.test(value)) {
        throw new ValidationError('Invalid IPv4 address');
      }
      return value;
    });

    this.registerValidator('ipv6', (value) => {
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (!ipv6Regex.test(value)) {
        throw new ValidationError('Invalid IPv6 address');
      }
      return value;
    });

    this.registerValidator('uuid', (value) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new ValidationError('Invalid UUID format');
      }
      return value;
    });

    this.registerValidator('alphanum', (value) => {
      const alphanumRegex = /^[a-zA-Z0-9]+$/;
      if (!alphanumRegex.test(value)) {
        throw new ValidationError('Must contain only alphanumeric characters');
      }
      return value;
    });

    this.registerValidator('alpha', (value) => {
      const alphaRegex = /^[a-zA-Z]+$/;
      if (!alphaRegex.test(value)) {
        throw new ValidationError('Must contain only letters');
      }

      return value;
    });

    this.registerValidator('number', (value) => {
      const num = Number(value);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        throw new ValidationError('Must be a number');
      }
      return num;
    });
    this.registerValidator('numeric', (value) => {
      let v = `${value}`

      const numericRegex = /^[0-9]+$/;
      if (!numericRegex.test(v)) {
        throw new ValidationError('Must contain only digits');
      }
      return value;
    });

    this.registerValidator('nonempty', (value) => {
      if (!(value && value.toString().trim().length > 0)) {
        throw new ValidationError('Value cannot be empty');
      }
      return value;
    });

    this.registerValidator('positive', (value) => {
      const num = Number(value);
      if (!(Number.isFinite(num) && num > 0)) {
        throw new ValidationError('Must be a positive number');
      }
      return num;
    });

    this.registerValidator('negative', (value) => {
      const num = Number(value);
      if (!(Number.isFinite(num) && num < 0)) {
        throw new ValidationError('Must be a negative number');
      }
      return num;
    });

    this.registerValidator('integer', (value) => {
      const num = Number(value);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        throw new ValidationError('Must be a number');
      }
      if (num !== Math.floor(num)) {
        throw new ValidationError('Must be an integer');
      }
      return num;
    });

    // Asynchronous validators for file system operations
    this.registerValidator('file', async (value) => {
      try {
        const stat = await fs.stat(value);
        if (!stat.isFile()) {
          throw new ValidationError('Path exists but is not a file');
        }
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ValidationError('File does not exist');
        }
        throw new ValidationError(`Cannot access file: ${error.message}`);
      }
    });

    this.registerValidator('directory', async (value) => {
      try {
        const stat = await fs.stat(value);
        if (!stat.isDirectory()) {
          throw new ValidationError('Path exists but is not a directory');
        }
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ValidationError('Directory does not exist');
        }
        throw new ValidationError(`Cannot access directory: ${error.message}`);
      }
    });

    this.registerValidator('readable', async (value) => {
      try {
        await fs.access(value, constants.R_OK);
        return value;
      } catch {
        throw new ValidationError('File is not readable');
      }
    }, () => 'path');

    this.registerValidator('writable', async (value) => {
      try {
        // Try to access the file
        await fs.access(value, constants.W_OK);
        return value;
      } catch (error) {
        // File doesn't exist or isn't writable
        if (error.code === 'ENOENT') {
          // File doesn't exist - check if parent directory is writable
          const path = await import('node:path');
          const parentDir = path.dirname(value);

          try {
            const stat = await fs.stat(parentDir);
            if (!stat.isDirectory()) {
              throw new ValidationError('Parent path exists but is not a directory');
            }
            await fs.access(parentDir, constants.W_OK);
            return value; // Parent is writable
          } catch (parentError) {
            if (parentError.code === 'ENOENT') {
              throw new ValidationError('Parent directory does not exist');
            }
            else if (parentError instanceof ValidationError) {
              throw parentError;
            }
            throw new ValidationError('Parent directory is not writable');
          }
        }
        throw new ValidationError('File is not writable');
      }
    }, () => 'path');

    // Async network validators
    this.registerValidator('reachable', async (value) => {
      try {
        await lookup(value);
        return value;
      } catch {
        throw new ValidationError('Host is not reachable');
      }
    });

    this.registerValidator('httpurl', async (value) => {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new ValidationError('URL must use HTTP or HTTPS protocol');
        }
        return value;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError('Invalid HTTP URL format', {cause: error});
      }
    });

    // Additional validators
    this.registerValidator('json', (value) => {
      try {
        JSON.parse(value);
        return value;
      } catch {
        throw new ValidationError('Invalid JSON format');
      }
    });

    this.registerValidator('base64', (value) => {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(value)) {
        throw new ValidationError('Invalid base64 format');
      }
      // If there's padding, length must be multiple of 4
      if (value.includes('=') && value.length % 4 !== 0) {
        throw new ValidationError('Invalid base64 format');
      }
      return value;
    });

    this.registerValidator('hex', (value) => {
      const hexRegex = /^[0-9a-fA-F]+$/;
      if (!hexRegex.test(value)) {
        throw new ValidationError('Must contain only hexadecimal characters');
      }
      return value;
    });

    this.registerValidator('executable', async (value) => {
      try {
        await fs.access(value, constants.X_OK);
        return value;
      } catch {
        throw new ValidationError('File is not executable');
      }
    }, () => 'path');

    // Parameterized validators
    this.registerParameterizedValidator('filesize', (args, compileSpec) => {
      if (typeof args !== 'object' || args === null) {
        throw new ResolverError('$filesize requires an object with min/max properties');
      }
      const { min, max } = args;

      return {
        validator: async (value) => {
          try {
            const stat = await fs.stat(value);
            const size = stat.size;

            if (min !== undefined && size < min) {
              throw new ValidationError(`File size must be at least ${min} bytes`);
            }
            if (max !== undefined && size > max) {
              throw new ValidationError(`File size must be at most ${max} bytes`);
            }
            return value;
          } catch (error) {
            if (error instanceof ValidationError) {
              throw error;
            }
            throw new ValidationError(`Cannot access file: ${error.message}`);
          }
        },
        description: min !== undefined && max !== undefined
                     ? `${min}-${max}B`
                     : min !== undefined
                       ? `≥${min}B`
                       : max !== undefined
                         ? `≤${max}B`
                         : undefined
      };
    });

    this.registerParameterizedValidator('and', (args, compileSpec) => {
      if (!Array.isArray(args)) {
        throw new ResolverError('$and requires an array of validators');
      }
      const compiled = args.map(v => compileSpec(v));
      const descriptions = compiled.map(c => c.description).filter(Boolean);

      return /** @type {CompiledSchemaOptions} */ ({
        validator: async (...params) => {
          let v = params[0];
          for (const {validator} of compiled) {
            v = await validator(v, ...params.slice(1));
          }
          return v;
        },
        description: descriptions.length > 1
                     ? descriptions.map(d => d.includes('|') ? `(${d})` : d).join(' & ')
                     : descriptions[0]
      });
    });

    this.registerParameterizedValidator('or', (args, compileSpec) => {
      if (!Array.isArray(args)) {
        throw new ResolverError('$or requires an array of validators');
      }
      const compiled = args.map(v => compileSpec(v));
      const descriptions = compiled.map(c => c.description).filter(Boolean);

      const description = descriptions.length > 1
                              ? descriptions.map(d => d.includes('&') ? `(${d})` : d).join('|')
                              : descriptions[0]
      return {
        validator: async (v, c, s, p, o) => {
          const errors = [];
          for (const {validator} of compiled) {
            try {
              return await validator(v, c, s, p, o);
            } catch (error) {
              errors.push(error.message);
            }
          }
          throw new ValidationError(`None of {${description}} matched`, {errors});
        },
        description
      };
    });

    this.registerParameterizedValidator('not', (args, compileSpec) => {
      const compiled = compileSpec(args);
      const needParens = /[|& ]/.test(compiled.description);

      return {
        validator: async (...params) => {
          try {
            await compiled.validator(...params);
          }
          catch (error) {
            return params[0];
          }
          throw new ValidationError('Value must not match the specified condition');
        },
        description: compiled.description
                     ? (needParens ? `!(${compiled.description})` : `!${compiled.description}`)
                     : undefined
      };
    });
    this.registerParameterizedValidator('range', (args, compileSpec) => {
      if (typeof args !== 'object' || args === null) {
        throw new ResolverError('$range requires an object with min/max properties');
      }
      const { min, max } = args;

      return {
        validator: async (value) => {
          const num = Number(value);
          if (!Number.isFinite(num)) {
            throw new ValidationError('Value must be a number');
          }
          if (min !== undefined && num < min) {
            throw new ValidationError(`Value must be at least ${min}`);
          }
          if (max !== undefined && num > max) {
            throw new ValidationError(`Value must be at most ${max}`);
          }
          return value;
        },
        description: min !== undefined && max !== undefined
                     ? `${min}-${max}`
                     : min !== undefined
                       ? `≥${min}`
                       : max !== undefined
                         ? `≤${max}`
                         : undefined
      };
    });

    this.registerParameterizedValidator('length', (args, compileSpec) => {
      if (typeof args !== 'object' || args === null) {
        throw new ResolverError('$length requires an object with min/max/exact properties');
      }
      const { min, max, exact } = args;

      return {
        validator: async (value) => {
          const length = Array.isArray(value) ? value.length : String(value).length;
          const unit = Array.isArray(value) ? 'elements' : 'characters';

          if (exact !== undefined && length !== exact) {
            throw new ValidationError(`Length must be exactly ${exact} ${unit}`);
          }
          if (min !== undefined && length < min) {
            throw new ValidationError(`Length must be at least ${min} ${unit}`);
          }
          if (max !== undefined && length > max) {
            throw new ValidationError(`Length must be at most ${max} ${unit}`);
          }
          return value;
        },
        description: exact !== undefined
                     ? `len=${exact}`
                     : min !== undefined && max !== undefined
                       ? `len=${min}-${max}`
                       : min !== undefined
                         ? `len≥${min}`
                         : max !== undefined
                           ? `len≤${max}`
                           : undefined
      };
    });

    this.registerParameterizedValidator('in', (args, compileSpec) => {
      if (!Array.isArray(args)) {
        throw new ResolverError('$in requires an array of allowed values');
      }

      return {
        validator: async (value) => {
          if (!args.includes(value)) {
            throw new ValidationError(`Value must be one of: ${args.join(', ')}`);
          }
          return value;
        },
        description: args.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('|')
      };
    });

    this.registerParameterizedValidator('each', (args, compileSpec) => {
      const compiled = compileSpec(args);

      return {
        validator: async (...params) => {
          const value = params[0];
          if (!Array.isArray(value)) {
            throw new ValidationError('Value must be an array');
          }
          const ret = [];
          for (const item of value) {
            ret.push(await compiled.validator(item, ...params.slice(1)));
          }
          return ret;
        },
        description: compiled.description !== undefined ? `[${compiled.description}]...` : 'values...'
      };
    });
  }

  /** @typedef {Object} CompiledSpec
   * @property {AsyncSchemaValueFunction<any>} [validator]
   * @property {string} [description]
   * @property {Function} [compile]
   */


  /**
   * Wrap a user-provided validator specification into a validation function
   * @param {any} spec - The validator specification
   * @returns {CompiledSchemaOptions} Async validation function that returns true or error message
   */
  _compileValidatorSpec(spec) {
    if (!spec) {
      return {
        validator: async (value) => value,
//        description: 'any'
      }
    }
    // Already a function - wrap to ensure it's async
    if (typeof spec === 'function') {
      return {
        validator: async (v, c, s, p, o) => spec(v, c, s, p, o),
        description: undefined
      }
    }

    // Regular expression object
    if (spec instanceof RegExp) {
      return {
        validator: async (value) => {
          if (!spec.test(String(value))) {
            throw new ValidationError(`Value does not match pattern ${spec}`);
          }
          return value;
        },
        description: spec.toString()
      };
    }

    // String handling
    if (typeof spec === 'string' && spec.startsWith('/') && spec.lastIndexOf('/') > 0) {
      // String regex pattern "/pattern/flags"
      const lastSlash = spec.lastIndexOf('/');
      const pattern = spec.slice(1, lastSlash);
      const flags = spec.slice(lastSlash + 1);

      try {
        const regex = new RegExp(pattern, flags);
        return {
          validator: async (value) => {
            if (!regex.test(String(value))) {
              throw new ValidationError(`Value does not match pattern ${spec}`);
            }
            return value;
          },
          description: spec
        }
      } catch (error) {
        throw new ResolverError(`Invalid regex pattern: ${spec}`);
      }
    }

    if (typeof spec === 'string' && spec.startsWith('$')) {
      const keyword = spec.slice(1);
      const registered = this.validatorMap.get(keyword);

      if (!registered) {
        throw new ResolverError(`Unknown validator keyword: ${spec}`);
      }

      return {
        validator: async (...args) => registered.validate?.(...args),
        description: registered.describe?.()
      }
    }

    if (typeof spec === 'string') {
      // Plain string - treat as exact match
      return {
        validator: async (value) => {
          if (String(value) !== spec) {
            throw new ValidationError(`Value must be exactly "${spec}"`);
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
        throw new ResolverError('Validator object must have exactly one key');
      }

      const [keyword] = keys;
      const keywordName = keyword.startsWith('$') ? keyword.slice(1) : keyword;
      const args = spec[keyword];

      const registered = this.validatorMap.get(keywordName);

      if (!registered) {
        throw new ResolverError(`Unknown validator keyword: ${keyword}`);
      }

      if (registered.compile) {
        // Parameterized validator - pass args and recursive compiler
        return registered.compile(args, (spec) => this._compileValidatorSpec(spec));
      } else {
        throw new ResolverError(`Validator ${keyword} does not accept arguments`);
      }


    }
    throw new ResolverError(`Invalid validator specification: ${spec}`);

  }

  /**
   * Build a compiled schema from the schema definition.
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @returns {CompiledSchema}
   */
  compile(inputSchema) {
    if (inputSchema instanceof CompiledSchema) {
      return inputSchema;
    }
    const compiledSchema = this._compile(inputSchema);
    this._finalize(compiledSchema);
    compiledSchema._freeze();
    return compiledSchema;
  }

  /**
   * @param {Schema|CompiledSchema|SchemaData} inputSchema
   * @param {Schema} [parent]
   * @param {string} [name]
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
      for (const [optionName, optionValue] of Object.entries(source.options ?? {})) {
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
   * @returns {CompiledSchema}
   * @private
   */
  _compile(inputSchema, parent, name) {

    const outputSchema = new CompiledSchema(CompiledSchema.__TOKEN, parent, name);
    if (!inputSchema.base) {
// fixme?      inputSchema.base = 'any';
    }

    const source = this._resolve(inputSchema);

    for (const [propName, propSchema] of Object.entries(source.properties ?? {})) {
      outputSchema.properties[propName] = this._compile(propSchema, outputSchema, propName);
    }
    for (const [metaName, metaValue] of Object.entries(source.metadata ?? {})) {
      outputSchema.metadata[metaName] = metaValue;
    }
    for (const [discriminatorValue, unionSchema] of Object.entries(source.unionSchemas ?? {})) {
      outputSchema.unionSchemas[discriminatorValue] = this._compile(unionSchema, parent, name);
    }

    // first pass over the defined options
    this._compileOptions({normalizer: undefined, ...source.options}, outputSchema);

    if (outputSchema.options.hook && typeof outputSchema.options.hook === 'function') {
      outputSchema.options.hook('compile', outputSchema);
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
   * @returns {CompiledSchema}
   * @private
   */
  _finalize(schema) {
    for (const propSchema of Object.values(schema.properties)) {
      this._finalize(propSchema);
    }
    for (const unionSchema of Object.values(schema.unionSchemas)) {
      this._finalize(unionSchema);
    }
    // second pass runs every compiler to ensure that any required options are set up
    this._compileOptions(undefined, schema);

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

    if (schema.options.literal && (schema.options.values?.length !== 1)) {
      throw new ConfiguratorError(`Literal schema${p} needs one value defined`);
    }
    if (schema.isUnion && schema.options.discriminator === undefined) {
      throw new ConfiguratorError(`Union schema${p} needs a discriminator defined`);
    }

    if (schema.hasChildren && schema.options.type !== 'object' && schema.options.type !== 'array' && schema.options.type !== 'any') {
      throw new ConfiguratorError(`Schema${p} has children defined but is not a container`);
    }

    if (schema.options.hook && typeof schema.options.hook === 'function') {
      schema.options.hook('finalize', schema);
    }
    return schema;
  }

  /**
   * @template TReturn
   * @param {SchemaValueFunction<TReturn>|TReturn} fn
   * @param {TReturn} [d]
   * @returns {SchemaValueFunction<TReturn>}
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
   * @param {SchemaValueFunction<TReturn>|TReturn} fn
   * @param {TReturn} [d]
   * @returns {AsyncSchemaValueFunction<TReturn>}
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
  _compileOptions(options, dst) {
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
          compiler.exec(optionName, optionValue, dst);
        }
      }
      phase++;
    }
  }
  /** @typedef {{exec:(option:string|undefined, value:any, dst:CompiledSchema) => void, phase?: number}} OptionCompiler */
  /** @type {Object.<string,OptionCompiler>} */
  _compilers = {
    '*': {
      exec: (option, value, dst) => {
        if (option && value !== undefined && dst.options[option] === undefined) {
          dst.options[option] = value;
        }
      },
      phase: 0
    },
    'values': {
      exec: (option, values, dst) => {
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
            dst.options.values.push(...values.map(v => dst.normalize(v, {}, dst.path)));
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
                  v.add(dst.normalize(typeof propSchema.options.selection === 'string'? propSchema.options.selection : propName));
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
      exec: (option, value, dst) => {
        if (!dst.options.normalizer) {
          dst.options.normalizer = (this._svf(value));
        }
      },
      phase: 1
    },
    'transformer': {
      exec: (option, value, dst) => {
        if (!dst.options.transformer) {
          dst.options.transformer = this._asyncifySVF(value);
        }
      },
      phase: 1
    },
    'validator': {
      exec: (option, value, dst) => {
        if (dst.options.validator) {
          return;
        }
        const c = this._compileValidatorSpec(value);
        dst.options.validator = c.validator;
        dst.metadata.validatorDescription = c.description ;

//        if (c.description && !dst.metadata.valueDescription) {
//          dst.metadata.valueDescription = c.description;
//        }

      },
      phase: 1
    },
    'serializer': {
      exec:(option, value, dst) => {
        if (!dst.options.serializer) {
          dst.options.serializer = this._asyncifySVF(value);
        }
      },
      phase: 1
    },
    'condition': {
      exec:(option, value, dst) => {
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
                return (s.normalize(selectorValue) === s.normalize(rawSelectionValue));
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
      exec:(option, value, dst) => {
        if (!value) {
          if (dst.isUnion && !dst.options.discriminator) {
            dst.options.discriminator = generateDiscriminatorFunction(dst);
            this._hoistDiscriminatorProperties(dst);
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

            const discriminatorValue = ref.normalize(rawDiscriminatorValue);
            unionSchema = dst.unionSchemas[discriminatorValue];

            if (unionSchema !== undefined) {
              return unionSchema;
            }
            for (const [unionSchemaKey, unionSchema] of Object.entries(dst.unionSchemas)) {
              if (ref.normalize(unionSchemaKey) === discriminatorValue) {
                return unionSchema;
              }
            }
            return undefined;
          }
          if (!ref.options.values) {
            ref.options.values = [];
            for (const discriminatorKey in dst.unionSchemas) {
              ref.options.values.push(ref.normalize(discriminatorKey));
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
  _hoistDiscriminatorProperties(schema) {
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
        propertySchema.values.forEach(v => {
          // Only check normalizer compatibility if we haven't already determined incompatibility
          if (normalizerCompatible && normalizer && normalizer(v, {}, propertySchema) !== v) {
            // Normalizers are incompatible - will fall back to 'any' with no normalizer
            normalizerCompatible = false;
          }
          values.add(propertySchema.normalize(v))  // aren't they already normalized?
          if (base === undefined) {
            if (this.hasSchema(typeof v)) {
              base = typeof v;
            }
          }
        });
      }

      // Use normalizer only if it's compatible across all union members
      const useNormalizer = normalizerCompatible && normalizer;

      if (!useNormalizer && base !== 'any') {
        throw new ConfiguratorError(`No compatible normalizer for common ${property} in union`)
      }
      // noinspection JSUnusedAssignment
      const hoisted = new Schema(base ?? 'any', useNormalizer ? { normalizer } : {});
      if (values.size > 0) {
        hoisted.values(Array.from(values))
      }

      const compiledHoisted = this._compile(hoisted, schema, property);
      this._finalize(compiledHoisted);

      schema.properties[property] = compiledHoisted;
    }

  }
}

class ResolverError extends ConfiguratorError {}