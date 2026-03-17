import { Executor, toExecutor } from './executor.js';
import { SchemaError } from '../schema-errors.js';

/** @typedef {[key:string, executor:Executor]} ObjectExecutorEntry */

/**
 * @augments {Executor<any>}
 */
export class ObjectExecutor extends Executor {

  /** @type {ObjectExecutorEntry[]} */
  #executorEntries = [];
  /** @type {((input:any) => any) | undefined} */
  #preprocess;

  /** @type {any} */
  #constantValue;

  /**
   * @param {object} [object]
   * @param {(input:any) => any} [preprocess]
   */
  constructor(object = {}, preprocess) {

    super();

    let isConstant = true;
    for (const [key, item] of Object.entries(object)) {
      if (item === undefined) {
        continue;
      }
      const itemExecutor = toExecutor(item);
      this.#executorEntries.push([key, itemExecutor]);
      isConstant &&= itemExecutor.isConstant;
    }
    this.#preprocess = preprocess;

    if (isConstant) {
      if (preprocess) {
        throw new SchemaError('Cannot use a preprocessor with a constant object executor');
      }
      this.#constantValue = Object.fromEntries(this.#executorEntries.map(([key, executor]) => [key, executor.execute(true)]));
    }

  }
  /**
   * @param {any} input
   * @param {...any} extra
   * @returns {object|Promise<object>}
   */
  execute(input, ...extra) {
    if (this.#constantValue !== undefined) {
      return this.#constantValue;
    }
    const output = {};
    let current = 0;

    const entries = this.#executorEntries;

    while (current < entries.length) {
      const key = entries[current][0];
      const executeInput = this.#preprocess? this.#preprocess(input) : input
      const result = entries[current++][1].execute(executeInput, ...extra);

      if (result instanceof Promise) {
        return result.then(resolved => {
          output[key] = resolved;
          return this.#resume(input, extra, current, output)
        })
      }
      else {
        output[key] = result;
      }
    }
    return output;
  }

  /**
   * @param {any} input
   * @param {any[]} extra
   * @param {number} resumeIndex
   * @param {object} output
   * @returns {Promise<object>}
   */
  async #resume(input, extra, resumeIndex, output) {
    const entries = this.#executorEntries;
    while (resumeIndex < entries.length) {
      const key = entries[resumeIndex][0];
      const executeInput = this.#preprocess? this.#preprocess(input) : input
      output[key] = await entries[resumeIndex++][1].execute(executeInput, ...extra);
    }
    return output;
  }
  get isConstant() {
    return this.#constantValue !== undefined;
  }
}
