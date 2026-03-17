import { Executor, toExecutor } from './executor.js';
import { deepEquals } from '../../utils.js';


/**
 * @augments Executor<any>
 */
export class PipelineExecutor extends Executor
{
  /** @type {Executor<any>[]} */
  #executors;

  /**
   * @param {Array<any>|any} pipeline - executors/functions/values to execute as a pipeline
   */
  constructor(pipeline = []) {
    if (!Array.isArray(pipeline)) {
      pipeline = [pipeline]
    }
    super();
    this.#executors = pipeline.map((/** @type {any} */ item) => toExecutor(item));
  }

  /**
   * @param {any} value
   * @param {...any} variadic
   * @returns {any|Promise<any>}
   */
  execute(value, ...variadic) {
//    if (value === null) {
//      return null;
//    }
    let current = 0;

    const executors = this.#executors;

    while (current < executors.length) {
      value = executors[current++].execute(value, ...variadic);

//      if (value === null) {
//        return null;
//      }

      if (value instanceof Promise) {
        return value.then(resolved => this.#resume(resolved, variadic, current));
      }
    }
    return value;
  }

  /**
   * @param {unknown} value
   * @param {any[]} variadic
   * @param {number} resumeIndex
   * @returns {Promise<any>}
   */
  async #resume(value, variadic, resumeIndex) {
    while (resumeIndex < this.#executors.length) {
//      if (value === null) {
//        return null;
//      }
      const input = value;
      value = await this.#executors[resumeIndex++].execute(value, ...variadic);
    }
    return value;
  }
}