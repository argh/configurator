import { Executor, toExecutor } from './executor.js';

/**
 * @template T
 * @template E
 * @augments {Executor<T>}
 */
export class EachExecutor extends Executor {
  /** @type {Executor<E>} */
  #executor;

  /** @type {((value:T|null|undefined)=>(E|null|undefined)[])|undefined} */
  #toValues;

  /** @type {((values:(E|null|undefined)[])=>T|null|undefined)|undefined} */
  #fromValues;

  /**
   * @param {Executor<E>|any} each - executor to apply to each value during execute
   * @param {(value:T|null|undefined)=>(E|null|undefined)[]} [toValues] - optional value factory
   * @param {((values:(E|null|undefined)[])=>T|null|undefined)} [fromValues]
   */
  constructor(each, toValues, fromValues) {
    super();
    this.#executor = toExecutor(each);
    this.#toValues = toValues;
    this.#fromValues = fromValues;
  }

  /**
   * @param {T|null|undefined} input
   * @param {...any} extra
   * @returns {T|null|undefined|Promise<T|null|undefined>}
   */
  execute(input, ...extra) {

    let values = (this.#toValues? this.#toValues(input) : /** @type {E[]} */ (input));

    if (!values) {
      return input;
    }

    if (!Array.isArray(values)) {
      values = [values];
    }

    let sync = true;

    const results = values.map(value => {
      const result = this.#executor.execute(value, ...extra);
      if (sync && result instanceof Promise) {
        sync = false;
      }
      return result;
    });

    if (sync) {
      // @ts-ignore
      return this.#fromValues? this.#fromValues(results) : results;
    }
    else {
      return Promise.all(results).then(resolved => {
        return this.#fromValues? this.#fromValues(resolved) : /** @type {T} */ (resolved);
      })
    }
  }
}