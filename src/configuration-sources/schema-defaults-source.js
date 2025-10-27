import { ConfigurationSource } from './configuration-source.js'
import { ConfiguratorError, SchemaError } from '../errors.js';
import { deepValue } from '../utils.js';
/** @import {CompiledSchema} from '../schema/compiled-schema.js' */

/**
 * Synthesize field assignments for all defaults specified in schema
 * Using a ConfigurationSource for this allows the defaults to be treated like low-priority assignments
 * that can be overridden and pruned (when excluded by an exclusive category).
 */
export class SchemaDefaultsSource
  extends ConfigurationSource
{
  constructor(options = {}) {
    super({...options, name: 'defaults-source', sequence: options.sequence || ConfigurationSource.DefaultSequence.SYSTEM_DEFAULTS});
  }

  /**
   * Parse configuration from this source
   * @param {CompiledSchema} schema
   * @param {object} context - collection of source-specific fields (argv, env, etc.)
   * @param {object} [options] - options for parsing (not used by this source)
   * @returns {Promise<Map<string,any>>} Parsed configuration object
   */
  async load(schema, context, options) {

    const assignments = new Map();

    schema.visitSchema(  (schema, path) => {
      if (path.indexOf('*') !== -1) {
        return;  // we can't synthesize default assignments for wildcard schemas!  or can we?  (leave the * as a marker?)
      }
      if (schema.default !== undefined) {
        if (assignments.has(path) && assignments.get(path) !== schema.default) {
          throw new SchemaError(`Ambiguous default value for ${path}: ${assignments.get(path)} vs ${schema.default}`)
        }

        if (schema.hasChildren) {
          const defaultAssignments = schema.toAssignments(schema.default, path);
          for (let [p,v] of defaultAssignments) {
            assignments.set(p, v);
          }
        }
        else {
          assignments.set(path, schema.default);
        }
      }
      if (schema.inherit) {
        let propName = path.substring(path.lastIndexOf('.') + 1)
        assignments.set(path, (_, config, schema, path) => {

          while (path) {
            let lastDot = path.lastIndexOf('.');
            if (lastDot === -1) {
              path = '';
            }
            else {
              path = path.substring(0, lastDot);
            }

            let value = deepValue(config, path? `${path}.${propName}` : `${propName}`);
            if (value) {
              return value;
            }
          }
        })
      }
    }, {addUnionKeys: true})

    return assignments;
  }
}