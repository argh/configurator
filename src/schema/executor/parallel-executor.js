
import { Executor, toExecutor } from './executor.js';

/**
 * Executes a fixed set of executors concurrently, passing the same input value and variadic arguments to each,
 * and returning an array of all results in the same order as the executors.
 *
 * When all executors are synchronous, execution is sequential and the result is a plain array.
 * When any executor returns a Promise, all results are collected via `Promise.all`, giving true
 * concurrent execution for I/O-bound processors.
 *
 * Errors propagate immediately — a synchronous throw or async rejection halts collection
 * and surfaces the error to the caller without waiting for remaining executors.
 *
 * @template T
 * @augments {Executor<T>}
 */
export class ParallelExecutor extends Executor {

  #executors;

  /**
   * @param {Array<any>} [parallel] - executors/functions/values to execute concurrently
   */
  constructor(parallel = []) {
    super();
    this.#executors = parallel.map((/** @type {any} */ item) => toExecutor(item));
  }

  /**
   * @param {T} input
   * @param {...any} variadic
   * @returns {any[]|Promise<any[]>}
   */
  execute(input, ...variadic) {
    let hasAsync = false;
    const results = this.#executors.map(exec => {
      const result = exec.execute(input, ...variadic);
      if (result instanceof Promise) hasAsync = true;
      return result;
    });
    return hasAsync ? Promise.all(results) : results;
  }
}