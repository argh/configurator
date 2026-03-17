
/** @import {Thenable} from './thenable.js' */

/**
 * @template T
 * @typedef {(input:T|null|undefined, ...variadic:any) => T|null|undefined|Promise<T|null|undefined>} ExecutorFunction
 */

/**
 * @template T
 * @template R
 * @typedef {(input:T|null|undefined, ...variadic:any) => R|null|undefined|Promise<R|null|undefined>} MappingExecutorFunction
 */

/**
 * An `Executor` is a composable unit of computation that processes an input into an output.
 *
 * Executors are designed for fine-grained runtime composition (executors calling other executors) and
 * are frequently used in hot code paths.  Executors may be synchronous or asynchronous, but fully synchronous
 * executor call chains are optimized to incur no async overhead.  Only the outermost call thus needs to be awaited.
 *
 * Errors are surfaced as exceptions or rejections.
 *
 * Combinator executors may catch and transform errors, or intercept and reinterpret intermediate outputs.
 *
 * @template T
 */
export class Executor
{
  /**
   * Process on a given input.
   *
   * The execute() method may return an output synchronously, or return a `Promise`
   * for deferred output.  Callers must handle both cases.
   *
   * Output value conventions:
   * - An output value of `null` signals that processing this input will *never* produce an output.  Most executors
   *   receiving `null` as input should propagate it immediately without processing, although coordinator executors
   *   that check for success or failure may choose to branch to an appropriate handler executor based on the result.
   * - An output value of `undefined` signals that this input could not be processed *at this time*.
   *   It is a soft signal (often used to halt a chain); individual executors define whether
   *   `undefined` is a legal input for their context.
   *
   * @param {T|null|undefined} input - required primary input
   * @param {...any} variadic - optional extra arguments (defined as needed by subclasses)
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(input, ...variadic) {
    return input;
  }

  get isConstant() {
    return false;
  }
}


/**
 * Wrap a provided executor function as an Executor
 *
 * @template T
 * @augments Executor<T>
 */
export class FunctionExecutor extends Executor {
  #execute;
  /**
   * @param {ExecutorFunction<T>} execute
   */
  constructor(execute) {
    super();
    this.#execute = execute;
  }

  /**
   * @param {T} input - required primary input
   * @param {...any} variadic - optional extra arguments (defined as needed by subclasses)
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(input, ...variadic) {
    return this.#execute(input, ...variadic);
  }
}

export class ConstantExecutor extends Executor {
  #value;
  /**
   * @param {any} value
   */
  constructor(value) {
    super();
    this.#value = value;
  }
  execute() {
    return this.#value;
  }

  get isConstant() {
    return true;
  }
}

export const NULL_EXECUTOR = new ConstantExecutor(null);
export const UNDEFINED_EXECUTOR = new ConstantExecutor(undefined);
export const TRUE_EXECUTOR = new ConstantExecutor(true);
export const FALSE_EXECUTOR = new ConstantExecutor(false);

/**
 * @template T
 * @param {T|Executor<T>|ExecutorFunction<T>} e
 * @returns {Executor<T>}
 */
export function toExecutor(e) {
  if (e instanceof Executor) {
    return e;
  }
  else if (typeof e === 'function') {
    // @ts-ignore
    return new FunctionExecutor(e);
  }
  else {
    return new ConstantExecutor(e);
  }
}