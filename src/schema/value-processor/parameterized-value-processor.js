import { ValueProcessor } from './value-processor.js';
import { SchemaLocation } from "../schema-location.js";

/** @import {ValueProcessorFunction, ValueProcessorDefinition, ValueProcessorArgs} from './value-processor.js' */

/**
 * @augments {ValueProcessor}
 */
export class ParameterizedValueProcessor extends ValueProcessor
{
  /** @type {ValueProcessor} */
  #mainProcessor;
  /** @type {ValueProcessor|undefined} */
  #argsProcessor;

  /**
   * @param {ValueProcessor} mainProcessor
   * @param {ValueProcessor|undefined} argsProcessor
   * @param {any} spec
   * @param {string} [description]
   */
  constructor(mainProcessor, argsProcessor, spec, description) {

    super(spec, description);
    this.#mainProcessor = mainProcessor;
    this.#argsProcessor = argsProcessor;
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
        return args.then(argsResolved => this.#mainProcessor.execute(value, target, location, {...options, args: argsResolved}))
      }
      return this.#mainProcessor.execute(value, target, location, {...options, args});
    }
    return this.#mainProcessor.execute(value, target, location, options);
  }
}
