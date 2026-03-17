import { Executor, toExecutor, UNDEFINED_EXECUTOR } from './executor.js';
import { isTruthy } from "../../utils.js";

/**
 * @template T
 * @typedef {object} ConditionalExecutorActions
 * @property {any} [success]
 * @property {any} [failure]
 */

/**
 * Checks if the provided predicate succeeds.  Usable as-is, or as a base class with behavior configured by flags.
 *
 * Default behavior simply tries running the predicate; if it throws or rejects, it is considered a failure.
 *
 * On success, the success action is called with the original input (default: returns the value)
 * On failure, the failure action is called with the original input (default: return undefined)
 *
 * @template T
 * @augments {Executor<T>}
 */
export class ConditionalExecutor extends Executor {
  /** @type {Executor} */
  #predicate;
  /** @type {Executor} */
  #success;
  /** @type {Executor} */
  #failure;

  /** @type {boolean} */
  #passResult = false;

  /** @type {boolean} */
  #passError = false;

  /** @type {boolean} */
  #checkTruthy = false;

  /** @type {boolean} */
  #checkDefined = false;

  /**
   * Construct a `ConditionalExecutor` from a predicate and optional success/failure executors.
   * - If no success executor is provided, the resolved value from the predicate is returned.
   * - If no failure executor is provided, `undefined` is returned.
   *
   * @param {any} predicate
   * @param {ConditionalExecutorActions<T>} [actions]
   * @param {symbol[]} [flags]
   */
  constructor(predicate, actions = {}, flags = []) {
    super();
    this.#predicate = toExecutor(predicate ?? new Executor());
    this.#success = toExecutor(actions.success ?? new Executor());
    this.#failure = toExecutor(actions.failure ?? UNDEFINED_EXECUTOR);

    for (const flag of flags) {
      if (flag === ConditionalExecutor.CHECK_TRUTHY) {
        this.#checkTruthy = true;
      }
      else if (flag === ConditionalExecutor.CHECK_DEFINED) {
        this.#checkDefined = true;
      }
      else if (flag === ConditionalExecutor.PASS_RESULT) {
        this.#passResult = true;
      }
      else if (flag === ConditionalExecutor.PASS_ERROR) {
        this.#passError = true;
      }
      else {
        throw new Error(`Unknown flag`);
      }
    }
  }

  /**
   * @param {T} input
   * @param {...any} variadic
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(input, ...variadic) {

    const handle = (error, result) => {

      let success;
      const value = this.#passResult ? result : input;
      const failureValue = this.#passError? error : value;

      if (error) {
        success = false;
      }
      else {
        if (this.#checkTruthy) {
          success = isTruthy(result);
        }
        else if (this.#checkDefined) {
          success = (result !== undefined);
        }
        else {
          success = true;
        }
      }
      if (success) {
        return this.#success.execute(value, ...variadic);
      }
      else {
        return this.#failure.execute(failureValue, ...variadic);
      }
    }

    let result;
    try {
      result = this.#predicate.execute(input, ...variadic);
    }
    catch (error) {
      return handle(error);
    }

    if (result instanceof Promise) {
      return result.then(resolved => {
        return handle(undefined, resolved);
      }, rejected => {
        return handle(rejected);
      })
    }
    return handle(undefined, result);
  }

  static CHECK_TRUTHY = Symbol('CHECK-TRUTHY');
  static CHECK_DEFINED = Symbol('CHECK-UNDEFINED');
  static PASS_RESULT = Symbol('PASS-RESULT');
  static PASS_ERROR = Symbol('PASS-ERROR');

}