import { ObjectSource } from './object-source.js';
import { ConfigurationSource } from './configuration-source.js';
import { ConfiguratorError } from '../configurator-error.js';
import { promises as fs } from 'fs';

export class JsonFileSource extends ObjectSource {
  constructor(options) {
    super(
      {
        ...options,
        sequence: options?.sequence || ConfigurationSource.DefaultSequence.CONFIGURATION,
        contextFieldName: options?.contextFieldName ?? 'config'
      })
  }

  async _load(configurator, context) {

    // intercept context field as a filename and rewrite it as an object

    let filename = context[this.contextFieldName];

    if (!filename || typeof filename !== 'string' || !filename.toLowerCase().endsWith('.json')) {
      return new Map();
    }

    try {
      const data = await fs.readFile(filename, 'utf8');
      return super._load(configurator, {[this.contextFieldName]: JSON.parse(data)});
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        throw new ConfiguratorError(`Configuration path ${filename} not found`);
      }
      else if (error.code === 'EISDIR') {
        throw new ConfiguratorError(`Configuration path ${filename} is a directory not a JSON file`);
      }
      else {
        throw new ConfiguratorError(`Error loading JSON configuration file: ${error.message}`, {cause: error});
      }
    }
  }


}