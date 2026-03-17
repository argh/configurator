import { SequenceExecutor } from './sequence-executor.js';

/**
 * Executes a fixed sequence of executors serially, passing each same input value and variadic arguments.
 * and returning the original input value on success.  This executor is intended for side-effect-style composition;
 * for chained processing, see `PipelineExecutor` or `StepExecutor`.  See `SequenceExecutor` to allow fine
 * tuning of sequence execution behavior.
 *
 * @template T
 * @augments {SequenceExecutor<T>}
 */
export class SerialExecutor extends SequenceExecutor {
  /**
   * @param {any[]|any} [serial]
   */
  constructor(serial = []) {
    if (!Array.isArray(serial)) {
      serial = [serial];
    }

    super(serial)
  }
}

