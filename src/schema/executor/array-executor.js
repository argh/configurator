import { Executor, toExecutor } from './executor.js';

/**
 * @augments {Executor<any>}
 */
export class ArrayExecutor extends Executor {

  /** @type {Executor<any>[]} */
  #executors = [];

  /** @type {any} */
  #constantValue;

  /**
   * @param {any[]|any} [array]
   */
  constructor(array = []) {
    if (!Array.isArray(array)) {
      array = [array];
    }
    super();

    let isConstant = true;
    for (const item of array) {
      const itemExecutor = toExecutor(item);
      isConstant &&= itemExecutor.isConstant;
      this.#executors.push(itemExecutor);
    }
    this.#constantValue = isConstant ? this.#executors.map(executor => executor.execute(true)) : undefined;
  }
  /**
   * @param {any} input
   * @param {...any} extra
   * @returns {any[]|Promise<any[]>}
   */
  execute(input, ...extra) {
    if (this.#constantValue !== undefined) {
      return this.#constantValue;
    }
    const output = [];
    let current = 0;

    const executors = this.#executors;

    while (current < executors.length) {
      const result = executors[current++].execute(input, ...extra);

      if (result instanceof Promise) {
        return result.then(resolved => {
          output.push(resolved);
          return this.#resume(input, extra, current, output)
        })
      }
      else {
        output.push(result);
      }
    }
    return output;
  }

  /**
   * @param {any} input
   * @param {any[]} extra
   * @param {number} resumeIndex
   * @param {Array<any>} output
   * @returns {Promise<any[]>}
   */
  async #resume(input, extra, resumeIndex, output) {
    while (resumeIndex < this.#executors.length) {
      output.push(await this.#executors[resumeIndex++].execute(input, ...extra));
    }
    return output;
  }

  get isConstant() {
    return this.#constantValue !== undefined;
  }
}
