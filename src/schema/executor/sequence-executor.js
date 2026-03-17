import { Executor, toExecutor } from './executor.js';
import { isTruthy } from '../../utils.js';

/**
 * Call a sequence of executors on the input until one returns a truthy value.  Exceptions/rejections are caught and
 * interpreted as a falsey value.  Return the first successful truthy result, or undefined on failure.
 *
 * @template T
 * @augments {Executor<T>}
 */
export class SequenceExecutor extends Executor {
  #executors;

  #criteriaBehavior;
  #checkBehavior;
  #returnBehavior;
  #errorBehavior;



  /**
   * @param {Array<any>|any} [executors]
   * @param {symbol[]} [flags]
   */
  constructor(executors = [], flags = []) {
    if (!Array.isArray(executors)) {
      executors = [executors];
    }
    super();
    this.#executors = executors.map((/** @type {any} */ item) => toExecutor(item));

    for (const flag of flags) {
      if (flag === SequenceExecutor.ALL_CRITERIA) {
        this.#criteriaBehavior = flag;
      }
      else if (flag === SequenceExecutor.ANY_CRITERIA) {
        this.#criteriaBehavior = flag;
      }
      else if (flag === SequenceExecutor.SUCCESS_CHECK) {
        this.#checkBehavior = flag;
      }
      else if (flag === SequenceExecutor.DEFINED_CHECK) {
        this.#checkBehavior = flag;
      }
      else if (flag === SequenceExecutor.TRUTHY_CHECK) {
        this.#checkBehavior = flag;
      }
      else if (flag === SequenceExecutor.INPUT_RETURN) {
        this.#returnBehavior = flag;
      }
      else if (flag === SequenceExecutor.RESULT_RETURN) {
        this.#returnBehavior = flag;
      }
      else if (flag === SequenceExecutor.RETHROW_ERRORS) {
        this.#errorBehavior = flag;
      }
      else if (flag === SequenceExecutor.CAPTURE_ERRORS) {
        this.#errorBehavior = flag;
      }
      else {
        throw new Error(`Unknown flag`);
      }
    }

    this.#criteriaBehavior ??= SequenceExecutor.ALL_CRITERIA;
    this.#checkBehavior ??= SequenceExecutor.SUCCESS_CHECK;
    this.#returnBehavior ??= SequenceExecutor.INPUT_RETURN;
    this.#errorBehavior ??= SequenceExecutor.RETHROW_ERRORS;
  }
  /**
   * @param {any} input
   * @param {...any} extra
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(input, ...extra) {
    let current = 0;

    const executors = this.#executors;

    let ret = input;

    while (current < executors.length) {
      let result;
      try {
        result = executors[current++].execute(input, ...extra);
        if (result instanceof Promise) {
          return result.then(
            resolved => {
              return this.#resume(input, extra, current, this.#handleResult(resolved, input))
            },
            rejected => {
              result = this.#handleFailure(rejected);
              return this.#resume(input, extra, current, result);
            })
        }
      }
      catch (error) {
        result = this.#handleFailure(error);
      }
      ret = this.#handleResult(result, input);

      if (this.#returnEarly(ret)) {
        return ret;
      }
    }
    return ret;
  }

  /**
   * @param {T} input
   * @param {any[]} extra
   * @param {number} resumeIndex
   * @param {any} ret
   * @returns {Promise<T|null|undefined>}
   */
  async #resume(input, extra, resumeIndex, ret) {
    while (resumeIndex < this.#executors.length) {
      if (this.#returnEarly(ret)) {
        return ret;
      }
      let result;
      try {
        result = await this.#executors[resumeIndex++].execute(input, ...extra);
      }
      catch (error) {
        result = this.#handleFailure(error);
        if (this.#checkBehavior === SequenceExecutor.SUCCESS_CHECK) {
          return undefined;
        }
      }
      ret = this.#handleResult(result, input);
    }
    return ret;
  }

  #returnEarly(ret) {
    return (ret === undefined)
           ? (this.#criteriaBehavior === SequenceExecutor.ALL_CRITERIA)
           : (this.#criteriaBehavior === SequenceExecutor.ANY_CRITERIA)
  }

  #handleResult(result, input) {
    if (this.#checkBehavior === SequenceExecutor.TRUTHY_CHECK) {
      if (isTruthy(result)) {
        return this.#returnBehavior === SequenceExecutor.RESULT_RETURN ? result : input;
      }
      else {
        return undefined;
      }
    }
    else if (this.#checkBehavior === SequenceExecutor.DEFINED_CHECK) {
      if (result !== undefined) {
        return this.#returnBehavior === SequenceExecutor.RESULT_RETURN ? result : input;
      }
      else {
        return undefined;
      }
    }
    else {
      return this.#returnBehavior === SequenceExecutor.RESULT_RETURN ? result : input;
    }
  }
  #handleFailure(error) {
    if (this.#errorBehavior === SequenceExecutor.RETHROW_ERRORS) {
      throw error;
    }
    return undefined;
  }


  static ANY_CRITERIA = Symbol('ANY-CRITERIA');
  static ALL_CRITERIA = Symbol('ALL-CRITERIA');

  static TRUTHY_CHECK = Symbol('TRUTHY-CHECK');
  static DEFINED_CHECK = Symbol('DEFINED-CHECK');
  static SUCCESS_CHECK = Symbol('SUCCESS-CHECK');

  static RESULT_RETURN = Symbol('RESULT-RETURN');
  static INPUT_RETURN = Symbol('INPUT-RETURN');

  static THROW_ERRORS = Symbol('THROW-ERRORS');  // todo - consider throwing on undefined in handleResult?
  static RETHROW_ERRORS = Symbol('RETHROW-ERRORS');
  static CAPTURE_ERRORS = Symbol('CAPTURE-ERRORS');

}

