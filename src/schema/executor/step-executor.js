import { Executor, toExecutor } from './executor.js';


/**
 * StepExecutor is basically like PipelineExecutor, except that null or undefined step results are returned immediately.
 *
 * @template T
 * @augments {Executor<T>}
 */
export class StepExecutor extends Executor {

  #steps;

  /**
   * @param {Array<any>|any} steps - executors/functions/values to execute as a pipeline
   */
  constructor(steps = []) {
    if (!Array.isArray(steps)) {
      steps = [steps]
    }
    super();
    this.#steps = steps.map((/** @type {any} */ item) => toExecutor(item));
  }

  /**
   * @param {T|null|undefined} value
   * @param {...any} variadic
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(value, ...variadic) {
    if (value === null || value === undefined) {
      return value;
    }
    let current = 0;

    const steps = this.#steps;

    while (current < steps.length) {
      value = steps[current++].execute(value, ...variadic);

      if (value === null || value === undefined) {
        return value;
      }

      if (value instanceof Promise) {
        return value.then(resolved => this.#resume(resolved, variadic, current));
      }
    }
    return value;
  }

  /**
   * @param {T|null|undefined} value
   * @param {any[]} variadic
   * @param {number} resumeIndex
   * @returns {Promise<T|null|undefined>}
   */
  async #resume(value, variadic, resumeIndex) {
    while (resumeIndex < this.#steps.length) {
      if (value === null || value === undefined) {
        return value;
      }
      value = await this.#steps[resumeIndex++].execute(value, ...variadic);
    }
    return value;
  }
}

