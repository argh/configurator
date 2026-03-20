import { Executor, FunctionExecutor, toExecutor } from '../executor/executor.js';
import { SchemaLocation } from '../schema-location.js';

/**
 * @callback ValueProcessorFunction
 * @param {any} value - The input value to be processed
 * @param {any} target - The top-level target object or value which is being built, if known (do not mutate)
 * @param {SchemaLocation} location - The path and schema of the value being processed within the schema hierarchy
 * @param {object} options - Options passed to the handler containing this value processor
 * @returns {any|Promise<any>} - Direct output value or a deferred promise if the value processor is asynchronous
 */

/** @typedef {`$${string}`} ValueProcessorKeyword */

/** @typedef {ValueProcessorKeyword|{[keyword:ValueProcessorKeyword]:ValueProcessorSpec}} KeywordValueProcessorSpec */

/** @typedef {ValueProcessorDefinition|ValueProcessorFunction|KeywordValueProcessorSpec|object|null|string|number|RegExp} ValueProcessorSpec */

/** @typedef {ValueProcessor[]|{[param:string]:ValueProcessor}} ValueProcessorArgs */

/**
 * @callback ValueProcessorBuilder
 * @param {ValueProcessorArgs} args
 * @param {object} [options]
 * @returns {ValueProcessor}
 */

/**
 * @typedef {object} ValueProcessorParameter
 * @property {string} parameter
 * @property {any} [default]
 * @property {boolean} [required]
 */

/**
 * @callback ValueProcessorDescriber
 * @param {{[param:string]:ValueProcessor}|ValueProcessor[]|undefined} args
 * @returns {string|undefined}
 */

/**
 * @typedef {object} ValueProcessorDefinition
 * @property {string} keyword
 * @property {ValueProcessorFunction} [process]
 * @property {ValueProcessorParameter[]} [parameters]
 * @property {string} [description]
 * @property {ValueProcessorBuilder} [build]
 * @property {ValueProcessorDescriber} [describe]
 */


/**
 * @augments {Executor<any>}
 */
export class ValueProcessor
  extends Executor {
  /** @type {string|undefined} */
  #description;

  /** @type {any} */
  #spec;

  /**
   * @param {any} [spec]
   * @param {string} [description]
   */
  constructor(spec, description) {
    super();
    this.#spec = spec;
    this.#description = description;
  }

  get description() {
    return this.#description;
  }

  set description(description) {
    this.#description = description;
  }

  get spec() {
    return this.#spec;
  }

  set spec(spec) {
    this.#spec = spec;
  }

  /**
   *
   * @param {any} value
   * @param {any} target
   * @param {SchemaLocation} location
   * @param {object} options
   * @returns {any|Promise<any>}
   */
  execute(value, target, location, options) {
    return value;
  }
}


