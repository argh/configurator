import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ValueProcessor } from "../value-processor/value-processor.js";
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { Executor } from '../executor/executor.js';

/**
 * **Processor**: `$not`
 *
 * Inverts a processor result - returns true if the wrapped processor throws or returns a falsey value.
 * Throw a constraint error if the wrapped processor returns a truthy value.
 *
 * This is useful for expressing negative constraints (e.g., "must not be a hostname").
 *
 * See `$never` to require the processor returns undefined or throws an exception.
 *
 * **Parameters**:
 * - `value` - a processor specification to negate.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}*
 */
export const NOT_CONSTRAINT = {
  keyword: 'not',

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
        throw new SchemaError('$not requires no more than a single value argument');
      }
    }
    else if (typeof args === 'object') {
      processor = args.processor;
    }
    if (!(processor instanceof ValueProcessor)) {
      throw new SchemaError('$not requires a value argument');
    }


    const needParens = processor.description && /[|&>∧· ]/.test(processor.description);
    const description = processor.description? (needParens ? `!(${processor.description})` : `!${processor.description}`)
                                                                  : undefined
    const spec = {$not: processor.spec};

    return new ComposedValueProcessor(new ConditionalExecutor(processor, {
      success: () => { throw new ConstraintError('Value must not match the specified condition'); },
      failure: () => true
    }, [ConditionalExecutor.CHECK_TRUTHY]), spec, description);
  }
};
