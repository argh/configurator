import { ConfigurationSource, DefaultSequence } from './configuration-source.js';
import { CompiledSchema } from '@versionzero/schema';

/**
 * `ObjectSource` - load configuration assignments from an object
 *
 * The object passed in the context is checked against the configuration schema.
 * If the schema defines child properties, then the object's children are recursively
 * checked in the same manner.
 *
 * When this process hits a schema that does not define children, an assignment is
 * generated with the current value.
 *
 * In other words, a given object may be broken out into a collection of individual
 * property assignments, or it could result in a single assignment; it depends on how
 * deeply nested the schemas are defined.
 */
export class ObjectSource extends ConfigurationSource
{
  constructor(options = {}) {
    super({...options, name: 'object-source', sequence: options?.sequence || DefaultSequence.APP_DEFAULTS});
    this.contextName = options?.contextName ?? 'data';
  }

  /**
   * Parse configuration from this source
   * @param {CompiledSchema} schema
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - load options
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async load(schema, context, options) {

    const object = context[this.contextName];
    if (!object) {
      return new Map();
    }
    // The schema already knows how to build assignments from an object!
    return schema.toAssignments(object);
  }

}