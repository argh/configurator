import { Buffer } from 'node:buffer';
import { toKebabCase } from './utils.js';
import { ConfiguratorError} from './configurator-error.js';

export class TypeRegistry
{
  constructor() {
    this._types = new Map();
    this._defineBuiltInTypes();
  }

  defineType(typeName, resolver, options = {}) {
    const typeOptions = {...options};
    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      const elementTypeName = toKebabCase(typeName.substring(1, typeName.length - 1).trim()) ?? 'string';

      typeName = `${elementTypeName}-list`
      typeOptions.isListType = true;
      typeOptions.elementTypeName = elementTypeName;

      if (!typeOptions.format) {
        typeOptions.format = (resolvedValue) => {
          if (resolvedValue === undefined || resolvedValue === null) {
            return undefined;
          }
          try {
            return JSON.stringify(resolvedValue);
          }
          catch (err) {
            return undefined;
          }
        }
      }

    }
    else {
      typeName = toKebabCase(typeName);
    }
    let type = {
      typeName, resolver, typeOptions
    }

    this._types.set(typeName, type);

    return type;
  }

  hasType(typeName) {
    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      const elementTypeName = toKebabCase(typeName.substring(1, typeName.length - 1).trim()) ?? 'string';
      typeName = `${elementTypeName}-list`
    }
    else {
      typeName = toKebabCase(typeName);
    }
    return this._types.has(typeName);
  }

  getType(typeName) {
    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      const elementTypeName = toKebabCase(typeName.substring(1, typeName.length - 1).trim()) ?? 'string';
      if (!this.hasType(elementTypeName)) {
        return undefined;
      }

      typeName = `${elementTypeName}-list`

      if (this.hasType(typeName)) {
        return this._types.get(typeName);
      }
      else {
        return {
          typeName,
          resolver: (rv, rc) => {
            if (!rv || rv.length === 0) {
              return [];
            }
            if (!Array.isArray(rv)) {
              rv = [rv];
            }
            return Promise.all(rv.map(async v => await this.resolveTypeValue(elementTypeName, v, rc)))
          },
          typeOptions: {isListType: true, elementTypeName}
        };
      }
    }
    else {
      return this._types.get(toKebabCase(typeName));
    }
  }

  async resolveTypeValue(typeName, value, configuration) {

    let type;

    type = this.getType(typeName);

    if (!type) {
      return undefined;
    }

    if (typeof value === 'function') {
      if (!configuration) {
        throw new ConfiguratorError('Cannot resolve type value without configuration');
      }
      const isConstructor = value.prototype?.constructor === value;
      if (!isConstructor) {
        value = await (async () => value(configuration, typeName))();
      }
    }
    if (value === undefined && !type.typeOptions?.allowUndefined) {
      return undefined;
    }

    if (type.typeOptions?.isListType && !Array.isArray(value)) {
      value = value? [value] : [];
    }

    return (async () => type.resolver(value, configuration, type))();
  }

  formatTypeValue(typeName, value) {
    let type = this.getType(typeName);
    if (!type) {
      return undefined;
    }
    return type.typeOptions?.format?.(value);
  }

  _defineBuiltInTypes() {
    this.defineType('string',
      (value) => { return String(value) },
      (value) => { return typeof value === 'string' }
      )
    this.defineType('number',
       (value) => {
        if (typeof value === 'number') return value;
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
      });
    this.defineType('boolean', (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      return Boolean(value);
    });
    this.defineType('array', (value) => {
      // todo - recursively handle member types?
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Handle comma-separated strings
        return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      return [value]; // Single value becomes array
    }); // todo - format?
    this.defineType('date', (value) => {
      if (value === 'now') {
        return Date.now();
      }
      else if (typeof value === 'string' || typeof value === 'number') {
        let t = new Date(value).getTime()
        if (isNaN(t)) {
          throw new ConfiguratorError(`Invalid timestamp value: ${value}`);
        }
        return t;
      }
      else {
        throw new ConfiguratorError(`Invalid timestamp value: ${value}`);
      }
    }, {
      format(value) {
        return new Date(value).toISOString();
      }
    });
    this.defineType('buffer', (value) => {
      try {
        if (typeof value === 'string') {
          return Buffer.from(value, 'base64');
        }
        else {
          return Buffer.from(value);
        }
      }
      catch (error) {
        throw new ConfiguratorError(`Invalid buffer value: ${value}`, {cause: error});
      }
    }, {
      /**
       * @param {Buffer} value
       * @returns {undefined|string}
       */
      format: (value) => {
        if (Buffer.isBuffer(value)) {
          return value.toString('base64');
        }
        else {
          return undefined;
        }
      }
    })
  }
}
