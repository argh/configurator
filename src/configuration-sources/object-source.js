import { ConfigurationSource } from './configuration-source.js'
/** @import {CompiledSchema} from '../schema/compiled-schema.js' */

export class ObjectSource extends ConfigurationSource
{
  constructor(options = {}) {
    super({...options, name: 'object-source', sequence: options?.sequence || ConfigurationSource.DefaultSequence.APP_DEFAULTS});
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

    const object = context[this.contextName] ?? {};

    // The schema already knows how to build assignments from an object!
    return schema.toAssignments(object);
  }

}