import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ValueProcessor } from "../value-processor/value-processor.js";
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { Executor } from '../executor/executor.js';

/**
 * ## $assert
 *
 * Require that the provided processor returns a truthy value; return original input.
 * Throws a constraint exception if not truthy.
 *
 * May be used inline in a pipeline without parameters, or can have a single processor argument.
 *
 * ### Parameters
 * - `processor` - an optional processor specification to check for truthiness.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const ASSERT_CONSTRAINT = {
  keyword: 'assert',
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
        throw new SchemaError('$assert requires a single processor argument');
      }
    }
    else if (typeof args === 'object') {
      processor = args.processor;
    }
    if (!(processor instanceof ValueProcessor)) {
      throw new SchemaError('$assert requires a processor argument');
    }

    const spec = args.length === 0? '$assert' : {'$assert': processor.spec};
    const description = processor.description;

    return new ComposedValueProcessor(
      new ConditionalExecutor(processor,
        { failure: (error) => {
          if (error instanceof ConstraintError) {
            throw error;
          }
          throw new ConstraintError('Processed value was not truthy', {cause: error}); } },
        [ConditionalExecutor.CHECK_TRUTHY, ConditionalExecutor.PASS_ERROR]
      ),
      spec, description);
  }
};
