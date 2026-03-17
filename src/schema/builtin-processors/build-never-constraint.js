import { ConstraintError, SchemaError } from '../schema-errors.js';
import { ValueProcessor } from "../value-processor/value-processor.js";
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { Executor } from '../executor/executor.js';

/**
 * **Processor**: `$never`
 *
 * Inverts a processor - Returns the input if the wrapped processor throws or returns an undefined value.
 * Throw a constraint error if the wrapped processor returns a defined value.
 *
 * See `$not` to enforce falseyness.
 *
 * **Parameters**:
 * - `value` - a processor specification to negate.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}*
 */
export const NEVER_CONSTRAINT = {
  keyword: 'never',

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
        throw new SchemaError('$never requires no more than a single value argument');
      }
    }
    else if (typeof args === 'object') {
      processor = args.processor;
    }
    if (!(processor instanceof ValueProcessor)) {
      throw new SchemaError('$never requires a value argument');
    }


    const needParens = processor.description && /[|&>∧· ]/.test(processor.description);
    const description = processor.description? (needParens ? `!(${processor.description})` : `!${processor.description}`)
                                                                  : undefined
    const spec = {$never: processor.spec};

    return new ComposedValueProcessor(new ConditionalExecutor(processor, {
      success: () => { throw new ConstraintError('Value must not match the specified condition'); },
      failure: (value) => value
    }, [ConditionalExecutor.CHECK_DEFINED]), spec, description);
  }
};
