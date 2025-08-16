import { ObjectSource } from './object-source.js';
import { ConfigurationSource } from './configuration-source.js';
import { ConfiguratorError } from '../configurator-error.js';
import { promises as fs } from 'fs';
import { text } from 'node:stream/consumers';

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

    let filename = context[this.contextFieldName];

    if (!filename || typeof filename !== 'string') {
      return new Map();
    }

    if (filename.trim() === '-') {
      try {
        const data = await text(process.stdin);
        const assignments = super._load(configurator, {[this.contextFieldName]: JSON.parse(data)});
        delete context[this.contextFieldName];
        return assignments;
      }
      catch (error) {
        throw new ConfiguratorError(`Error loading JSON configuration from stdin: ${error.message}`, {cause: error});
      }
    }
    else if (filename.toLowerCase().endsWith('.json')) {
      try {
        const data = await fs.readFile(filename, 'utf8');
        const assignments = super._load(configurator, {[this.contextFieldName]: JSON.parse(data)});
        delete context[this.contextFieldName];
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