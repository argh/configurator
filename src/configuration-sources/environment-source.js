import { deepAssign, toCamelCase, toConstantCase } from '../utils.js';

import { ConfigurationSource } from './configuration-source.js'
import { ConfiguratorError } from '../errors.js';

/** @import {CompiledSchema} from '../schema/compiled-schema.js' */

export class EnvironmentSource extends ConfigurationSource {
  constructor(options = {}) {
    super({...options, name: 'environment-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.ENVIRONMENT});

    this.contextName = options?.contextName ?? 'env'
  }
  /**
   * Parse configuration from this source
   * @param {CompiledSchema} schema
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - load options
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */

  async load(schema, context, options) {

    const strict = options?.strict ?? false;
    const appName = context?.appName;
    const appPrefix = toConstantCase(appName? appName : '');
    const propertyPaths = schema.getPropertyPaths();
    const propertyPatterns = new Map();

    for (let path of propertyPaths) {
      propertyPatterns.set(path, compilePattern(appPrefix, path));
    }

    const env = context[this.contextName] ?? process.env;
    const assignments = new Map();

    for (let [envVarName, envValue] of Object.entries(env)) {
      if (appPrefix && envVarName.indexOf(`${appPrefix}_`) !== 0) {
        continue;
      }
      let found = false;
      for (const [ path, regex ] of propertyPatterns) {
        const match = regex.exec(envVarName);
        if (match) {
          found = true;
          // If there are captured groups (wildcards), substitute them into the path
          let actualPath = path;
          if (match.length > 1) {
            const wildcardValues = match.slice(1);
            let wildcardIndex = 0;
            actualPath = path.split('.').map(segment => {
              if (segment === '*') {
                // Convert captured CONSTANT_CASE back to camelCase
                return toCamelCase(wildcardValues[wildcardIndex++]);
              }
              return segment;
            }).join('.');
          }
          assignments.set(actualPath, envValue);
          break;
        }
      }
      if (!found && strict) {
        throw new EnvironmentError(`Unexpected environment variable: ${envVarName}`)
      }
    }
    return assignments;
  }
}
/**
 * Compiles a dotted path pattern into a regex with capture groups for wildcards
 * @param {string} appPrefix - app name prefix, in CONSTANT_CASE
 * @param {string} pattern - Dotted path pattern
 * @returns {RegExp} Compiled regex with capture groups for each wildcard
 */
function compilePattern(appPrefix, pattern) {
  const segments = pattern.split('.');

  let regexPattern = segments
    .map(segment => segment === '*' ? '([A-Z0-9_]+?)' : toConstantCase(segment))
    .join('_');

  if (appPrefix && !regexPattern.startsWith(`${appPrefix}_`)) {
    regexPattern = `${appPrefix}_${regexPattern}`
  }

  return new RegExp(`^${regexPattern}$`);
}

export class EnvironmentError extends ConfiguratorError {
  constructor(message, data) {
    super(message, data);
  }
}
