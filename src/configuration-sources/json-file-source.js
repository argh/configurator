import { ObjectSource } from './object-source.js';
import { DefaultSequence } from './configuration-source.js';
import { ConfiguratorError } from '../errors.js';
import { promises as fs } from 'fs';
import { text } from 'node:stream/consumers';
import {CompiledSchema} from '@versionzero/schema';


/**
 * `JsonFileSource` - load assignments from a JSON formatted configuration file, or stdin if passed "-"
 *
 * This leverages `ObjectSource` once the data has been pulled in.
 *
 * Multiple configuration file sources may exist; each needs to examine the path / file and independently
 * decide whether they will handle it.  By contract, when a configuration file source reads the file,
 * it must delete the config key from the context to ensure no other source also reads it.
 * (Configurator will throw a "could not load file" error if the context key still exists after all sources are loaded).
 */
export class JsonFileSource extends ObjectSource {
  constructor(options) {
    super(
      {
        ...options,
        sequence: options?.sequence || DefaultSequence.CONFIGURATION,
        contextName: options?.contextName ?? 'config'
      })
  }

  /**
   * @param {CompiledSchema} schema
   * @param {object} context
   * @param {object} [options]
   * @returns {Promise<Map<string,any>>}
   */
  async load(schema, context, options) {
    const filename = context[this.contextName];

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