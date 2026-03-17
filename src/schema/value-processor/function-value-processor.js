import { ValueProcessor } from './value-processor.js';
import { isEmpty, map } from '../../utils.js';
import { SchemaLocation } from "../schema-location.js";
import { SchemaError } from '../schema-errors.js';

/** @import {ValueProcessorFunction, ValueProcessorDefinition, ValueProcessorArgs} from './value-processor.js' */

/**
 * @augments {ValueProcessor}
 */
export class FunctionValueProcessor extends ValueProcessor
{
  /** @type {ValueProcessor|undefined} */
  #argsProcessor;

  /** @type {ValueProcessorFunction} */
  #process;

  /**
   * @param {ValueProcessorFunction} process
   * @param {ValueProcessor} [args]
   */
  constructor(process, args) {
    super();

    if (args) {
      if (!(args instanceof ValueProcessor)) {
        throw new SchemaError('FunctionValueProcessor args must be a ValueProcessor');
      }
      this.#argsProcessor = args;
    }

    this.#process = process;
    this.spec = process;
  }

  /**
   * @param {any} value
   * @param {any} target
   * @param {SchemaLocation} location
   * @param {object} options
   * @returns {any|null|undefined|Promise<any|null|undefined>}
   */
  execute(value, target, location, options) {
    if (this.#argsProcessor) {
      const args = this.#argsProcessor.execute(value, target, location, options);

      if (args instanceof Promise) {
        return args.then(argsResolved => this.#process(value, target, location, {...options, args: argsResolved}))
      }
      return this.#process(value, target, location, {...options, args});
    }
    return this.#process(value, target, location, options);
  }
}

/**
 * @param {string} keyword
 * @param {ValueProcessorArgs|undefined} args
 * @returns {any}
 */
function getSpec(keyword, args) {
  if (!args || isEmpty(args)) {
    return `$${keyword}`;
  }
  return {[`$${keyword}`]: map(args, arg => arg.spec)};
}