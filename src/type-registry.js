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
      },
      (value => { return typeof value === 'number' })  // FIXME!
      );
    this.defineType('boolean', (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      return Boolean(value);
    }, (value => { return typeof value === 'boolean' })); // FIXME
    this.defineType('array', (value) => {
      // todo - recursively handle member types?
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Handle comma-separated strings
        return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      return [value]; // Single value becomes array
    },
      (value) => { return Array.isArray(value) } // FIXME
    )



  }
}
