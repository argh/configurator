import { deepAssign, toCamelCase, toConstantCase, toKebabCase } from '../utils.js';

import { ConfigurationSource } from './configuration-source.js'

export class ObjectSource extends ConfigurationSource
{
  constructor(options) {
    super('object-source', options?.sequence || ConfigurationSource.DefaultSequence.APP_DEFAULTS);
    this.contextFieldName = options?.contextFieldName ?? 'data';
  }

  /**
   * Parse configuration from this source
   * @param {ConfigurationSchema} schema - Schema to use for parsing
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - options for parsing
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async _load(schema, context, options) {

    const object = context[this.contextFieldName] ?? {};

    const allFields = schema.getAllFieldPaths({hidden: true, advanced: true, system: true});

    const fieldValues = new Map();

    function walk(object, prefix) {

      for (const [key, value] of Object.entries(object)) {

        const canonicalFieldName = toCamelCase(key);

        const path = prefix ? `${prefix}.${canonicalFieldName}` : canonicalFieldName;

        if (typeof value === 'object' && !Array.isArray(value)) {
          walk(value, path);
        }
        else if (allFields.has(path)) {
          fieldValues.set(path, value);
        }
        else if (options?.strict) {
          throw new Error(`Unknown field reference "${path}"`);
        }
      }
    }
    walk(object);

    return fieldValues;
  }
}