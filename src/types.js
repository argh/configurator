import { toKebabCase } from './utils.js';
import { ConfiguratorError} from './configurator-error.js';

export class Types
{
  constructor() {
    this._types = new Map();
    this._defineBuiltInTypes();
  }

  defineType(typeName, resolver, options = {}) {
    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      typeName = typeName.substring(1, typeName.length - 1).trim();

      if (typeName === '') {
        typeName = 'string';
      }
      typeName = `${toKebabCase(typeName)}-list`
    }
    else {
      typeName = toKebabCase(typeName);
    }
    let type = {
      typeName, resolver, options
    }

    this._types.set(typeName, type);

    return type;
  }

  getType(typeName) {
    return this._types.get(toKebabCase(typeName));
  }

  async resolveTypeValue(typeName, value, configuration) {

    if (typeof value === 'function') {
      if (!configuration) {
        throw new ConfiguratorError('Cannot resolve type value without configuration');
      }
      let isConstructor = value.prototype && value.prototype.constructor === value;
      if (!isConstructor) {
        value = await (async () => value(configuration, typeName))();
      }
    }

    if (value === undefined) {
      return undefined;
    }
    let type;

    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      typeName = toKebabCase(typeName.substring(1, typeName.length - 1).trim());
      if (typeName === '') {
        typeName = 'string';
      }
      if (!Array.isArray(value)) {
        value = [value];
      }

      // if we have a registered type handler for this type, use it.

      type = this.getType(`${typeName}-list`);

      if (type) {
        return (async () => type.resolver(value, configuration, type))();
      }
      else {
        return Promise.all(value.map(async v => await this.resolveTypeValue(typeName, v, configuration)));
      }
    }
    type = this.getType(toKebabCase(typeName));
    if (!type) {
      return undefined;
    }
    return (async () => type.resolver(value, configuration, type))();
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
