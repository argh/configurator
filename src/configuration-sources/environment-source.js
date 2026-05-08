import { ConfigurationSource, DefaultSequence } from './configuration-source.js'
import { ConfiguratorError } from '../errors.js';
import { CompiledSchema } from '@versionzero/schema';
import { toCamelCase, toConstantCase } from '@versionzero/schema/helpers';

/**
 * EnvironmentSource - load configuration assignments from environment variables
 *
 * Given "server.host", we will load SERVER_HOST.
 *
 * It's a good idea to pass in an appName prefix to ensure you don't accidentally load
 * random environment variables that might collide (e.g. "DEBUG" or "VERBOSE").
 * (In strict mode, encountering an unexpected environment variable will throw.)
 * Given "example" as the appName with "server.host", the variable loaded is EXAMPLE_SERVER_HOST.
 *
 * If your schema has a top-level child with the same property name as the app name, the
 * prefix is truncated for aesthetics (e.g. to avoid having EXAMPLE_EXAMPLE_SERVER_HOST).
 * (This could lead to some ambiguity between identically named root and app child properties!)
 *
 * Due to the possibility of wildcards in the schema, we can't just determine all
 * possible environment variables; we actually need to work in reverse and see if
 * a given environment variable can be mapped back to the schema.  This process
 * assumes that the property names are in camelCase.
 *
 * There is thus also an ambiguity between whether EXAMPLE_SERVER_HOST should be interpreted
 * as example.server.host or example.serverHost.  The algorithm tries to resolve this
 * ambiguity by incrementally "growing" the number of words camelCased until it finds
 * a match.  (Actually defining both would be a true ambiguity, so... don't do that!)
 */
export class EnvironmentSource extends ConfigurationSource {
  constructor(options = {}) {
    super({...options, name: 'environment-source', sequence: options.sequence || DefaultSequence.ENVIRONMENT});

    this.contextName = options?.contextName ?? 'env'
  }

  /**
   * load - return a map of assignments parsed from environment variables
   *
   * Defaults to using process.env, but you can pass in an object in the context
   * (default key: "env") containing variables in the same format.
   *
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

    for (const path of propertyPaths) {
      propertyPatterns.set(path, compilePattern(appPrefix, path));
    }

    const env = context[this.contextName] ?? process.env;
    const assignments = new Map();

    for (const [envVarName, envValue] of Object.entries(env)) {
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
      if (!found && appPrefix && strict) {
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
