import { ObjectSource } from './object-source.js';
import { ConfigurationSource } from './configuration-source.js';
import { ConfiguratorError } from '../errors.js';
import { promises as fs } from 'fs';
import { text } from 'node:stream/consumers';
/** @import {CompiledSchema} from '../schema/compiled-schema.js' */


export class JsonFileSource extends ObjectSource {
  constructor(options) {
    super(
      {
        ...options,
        sequence: options?.sequence || ConfigurationSource.DefaultSequence.CONFIGURATION,
        contextName: options?.contextName ?? 'config'
      })
  }

  /**
   * @param {CompiledSchema} schema
   * @param {Object} context
   * @param {Object} [options]
   * @returns {Promise<Map<string,any>>}
   */
  async load(schema, context, options) {

// FIXME    if (!this.contextName) {
//      const configSchema = Object.values(schema.properties).find(s => s.metadata['configuratorSchema'] === 'config');

    let filename = context[this.contextName];

    if (!filename || typeof filename !== 'string') {
      return new Map();
    }

    if (filename.trim() === '-') {
      try {
        const data = await text(process.stdin);
        const assignments = super.load(schema, {[this.contextName]: JSON.parse(data)});
        delete context[this.contextName];
        return assignments;
      }
      catch (error) {
        throw new ConfiguratorError(`Error loading JSON configuration from stdin: ${error.message}`, {cause: error});
      }
    }
    else if (filename.toLowerCase().endsWith('.json')) {
      try {
        const data = await fs.readFile(filename, 'utf8');
        const assignments = await super.load(schema, {[this.contextName]: JSON.parse(data)});
        delete context[this.contextName];
        return assignments;
      }
      catch (error) {
        if (error.code === 'ENOENT') {
          throw new ConfiguratorError(`Configuration path ${filename} not found`);
        }
        else if (error.code === 'EISDIR') {
          throw new ConfiguratorError(`Configuration path ${filename} is a directory, not a JSON file`);
        }
        else {
          throw new ConfiguratorError(`Error loading JSON configuration file: ${error.message}`, {cause: error});
        }
      }
    }
    else {
      return new Map();
    }
  }


}