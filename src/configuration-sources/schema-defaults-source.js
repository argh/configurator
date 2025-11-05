import { ConfigurationSource } from './configuration-source.js'
import { ConfiguratorError, SchemaError } from '../errors.js';
import { deepValue } from '../utils.js';
/** @import {CompiledSchema} from '../schema/compiled-schema.js' */

/**
 * SchemaDefaultsSource - synthesize field assignments for all defaults specified anywhere in the configuration schema
 *
 * Using a ConfigurationSource for this allows the defaults to be treated like low-priority assignments
 * that can be overridden and pruned (when excluded by an exclusive category).
 *
 * While this is most used for regular schema defaults, a common pattern is to have a schema define a default
 * (often with a value like "null" or "true") to ensure an assignment triggers a transform (that may even
 * ignore the input value!)  For example, imagine you define a schema with a transform that always returns the
 * current date; you probably wouldn't want to have it triggered by normal configuration, so you trigger it
 * with a default.
 *
 * Another trick is to set a default to be a function, which will only be evaluated if the assignment is actually
 * processed.  If the default is overridden, or pruned due to a failed condition (i.e. a parent schema is skipped)
 * then the function will never be called.  This lazy evaluation is useful when computing the default value may
 * have side effects or hidden costs, like instantiating a singleton or calling an external service.
 *
 * Note that this source is currently unable to populate defaults under wildcard paths, but there is some "fallback"
 * logic (in CompiledSchema.validate and .visit) that attempts to fill in missing defaults.
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