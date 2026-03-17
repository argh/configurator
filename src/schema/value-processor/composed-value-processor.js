import { Executor } from "../executor/executor.js";
import { stringify } from "../helpers/stringify.js";
import { ValueProcessor } from './value-processor.js';
import { isPrimitive } from '../../utils.js';

/**
 * Wrap an existing executor as a ValueProcessor
 *
 * @augments {ValueProcessor}
 */
export class ComposedValueProcessor extends ValueProcessor
{
  /** @type {Executor<any>} */
  #executor;

  /**
   * @param {Executor<any>} executor
   * @param {any} spec
   * @param {string} [description]
   */
  constructor(executor, spec, description) {
    if (executor instanceof ValueProcessor) {
      description = executor.description;
    }
    if (!description && executor.isConstant) {
      const results = executor.execute(true);
      description = isPrimitive(results)? `${results}`: stringify(results);
    }
    super(spec, description);
    this.#executor = executor;
  }

  execute(value, target, location, options) {
    return this.#executor.execute(value, target, location, options);
  }

  get isConstant() {
    return this.#executor.isConstant;
  }


}