import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ValueProcessor } from './value-processor.js';
import { SchemaLocation } from "../schema-location.js";

/**
 * @augments {ValueProcessor}
 */
export class RegExpValueProcessor extends ValueProcessor
{
  /** @type {RegExp} */
  #regex;

  /**
   * @param {string|RegExp} spec
   */
  constructor(spec) {
    super();

    if (typeof spec === 'string' && spec.startsWith('/') && spec.lastIndexOf('/') > 0) {
      // String regex pattern "/pattern/flags" - parse and fall through to the regex rule
      const lastSlash = spec.lastIndexOf('/');
      const pattern = spec.slice(1, lastSlash);
      const flags = spec.slice(lastSlash + 1);

      try {
        spec = new RegExp(pattern, flags);
      }
      catch (error) {
        throw new SchemaError(`Invalid regex pattern`, {value: spec});
      }
    }
    if (!(spec instanceof RegExp)) {
      throw new SchemaError(`Invalid regex pattern`, {value: spec})
    }
    this.#regex = spec;
    this.spec = spec;
    this.description = `${spec}`;
  }
  /**
   * @param {any} value
   * @param {any} target
   * @param {SchemaLocation} location
   * @param {object} options
   * @returns {any|Promise<any>}
   */
  execute(value, target, location, options) {
    if (!this.#regex.test(String(value))) {
      throw new ConstraintError(`Value does not match pattern ${this.#regex}`, {location});
    }
    return value;
  }
}