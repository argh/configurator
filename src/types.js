import { toKebabCase } from './utils.js';


export class Types
{
  constructor() {
    this._types = new Map();
    this._defineBuiltInTypes();
  }

  defineType(typeName, resolver, options = {}) {

    typeName = toKebabCase(typeName);
    let type = {
      typeName, resolver, options
    }

    this._types.set(typeName, type);

    return type;
  }

  getType(typeName) {
    return this._types.get(toKebabCase(typeName));
  }

  resolveTypeValue(typeName, value, configuration) {
    const type = this.getType(typeName);

    if (!type) {
      return undefined;
    }

    let v = value;
    if (typeof value === 'function') {
      if (!configuration) {
        throw new Error('Cannot resolve type value without configuration');
      }
      v = value(configuration, type);
    }

    if (v === undefined) {
      return undefined;
    }

    return type.resolver(v, configuration, type);
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
      (value => { return typeof value === 'number' })
      );
    this.defineType('boolean', (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      return Boolean(value);
    }, (value => { return typeof value === 'boolean' }));
    this.defineType('array', (value) => {
      // todo - recursively handle member types?
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Handle comma-separated strings
        return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      return [value]; // Single value becomes array
    },
      (value) => { return Array.isArray(value) }
    )



  }
}
