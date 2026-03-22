import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ValueProcessor } from "../value-processor/value-processor.js";
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { Executor } from '../executor/executor.js';

/**
 * ## $require
 *
 * Require that the provided processor returns a defined value; return the processed value.
 * Throws a constraint error if the processor does not return a defined value.
 *
 * May be used inline in a pipeline without parameters, or can have a single processor argument.
 *
 * ### Parameters
 * - `processor` - an optional processor specification to check for a defined value.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const REQUIRE_CONSTRAINT = {
  keyword: 'require',
  build: (args) => {

    /** @type {ValueProcessor|undefined} */
    let processor;
    if (Array.isArray(args)) {
      if (args.length === 1) {
        processor = args[0];
      }
      else if (args.length === 0) {
        processor = new ComposedValueProcessor(new Executor(), []);
      }
      else {
        throw new SchemaError('$require requires no more than a single processor argument');
      }
    }
    else if (typeof args === 'object') {
      processor = args.processor;
    }
    if (!(processor instanceof ValueProcessor)) {
      throw new SchemaError('$require requires a processor argument');
    }

    const spec = args.length === 0? '$require' : {'$require': processor.spec};
    const description = processor.description;

    return new ComposedValueProcessor(
      new ConditionalExecutor(processor,
        { failure: (error) => {
          if (error instanceof ConstraintError) {
            throw error;
          }
          throw new ConstraintError('Processed value was undefined', {cause: error}); } },
        [ConditionalExecutor.CHECK_DEFINED, ConditionalExecutor.PASS_ERROR]
      ),
      spec, description);
  }
};
