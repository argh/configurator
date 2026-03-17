import { TraversalState } from '../traversal-state.js';
import { Executor, toExecutor } from '../../executor/executor.js';
import { EachExecutor } from '../../executor/each-executor.js';
import { SerialExecutor } from "../../executor/serial-executor.js";


/**
 * @augments Executor<TraversalState>
 */
export class TraversalStateExecutor extends Executor
{
  /** @type {Executor<TraversalState>} */
  #executor;

  /**
   * @param {any} enter
   * @param {any} exit
   */
  constructor(enter, exit) {
    super();
    /** @type {Executor<TraversalState>} */
    const enterExecutor = toExecutor(enter);
    /** @type {Executor<TraversalState>} */
    const exitExecutor = toExecutor(exit);

    // wrap Each in a Serial so that we can return the original input instead of the processed array
    /** @type {Executor<TraversalState>} */
    const childExecutor = new SerialExecutor(
      /** @type {Executor<TraversalState>} */ (new EachExecutor(this, ((state) => state?.activePropertyStates ?? [])))
    );

    // todo - wrap in a TryExecutor so we can ensure the location is set in any exceptions
    this.#executor = new SerialExecutor([enterExecutor, childExecutor, exitExecutor]);
  }


  /**
   *
   * @param {TraversalState} state
   * @returns {TraversalState|null|undefined|Promise<TraversalState|null|undefined>}
   */
  execute(state) {
    return this.#executor.execute(state);
  }
}

