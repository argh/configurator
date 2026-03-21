import { isEmpty, map } from "../../utils.js";
import { ConstraintError, ResolverError, SchemaError } from '../schema-errors.js';
import { ComposedValueProcessor } from "../value-processor/composed-value-processor.js";
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';

/** @import {ValueProcessor, ValueProcessorDefinition} from '../value-processor/value-processor.js' */

/**
 * **Processor**: `$in`
 *
 * Validates that a value is included in an allowed list of values.
 * Uses strict equality (===) for comparison.
 *
 * **Parameters**:
 * The parameter is an array (not an object) of allowed values passed directly to the processor.
 * - Array of values (array, required): The allowed values to match against using strict equality
 *
 * **Valid values**: Any value that matches (using `===`) an element in the allowed array
 *
 * **Invalid values**: Any value not present in the allowed array
 *
 * @type {ValueProcessorDefinition}
 */
export const IN_CONSTRAINT = {
  keyword: 'in',

  build: (args) => {

    const vpa = (Array.isArray(args)? args : args?.['values']);

    if (isEmpty(args)) {
      throw new SchemaError('Must define at least one value for $in');
    }

    const description = Array.isArray(vpa)? vpa.map(v => v.description).join('|')
                                          : '[?]';

    const argsSpec = map(vpa, v => v.spec)
    const spec = {$in: argsSpec}

    /** @type {ValueProcessor} */
    const processor =
      new FunctionValueProcessor(
        (value, _target, location, options) => {
          const values = (Array.isArray(options.args)? options.args : args.values) ?? [];
          if (!values.includes(value)) {
            throw new ConstraintError(`Value must be one of {${values.join('|')}}`, {location});
          }
          return value;
        }, new ComposedValueProcessor(new ArrayExecutor(vpa), argsSpec)
      );
    // yuck, need a better contract for this...
    processor.spec = spec;
    processor.description = description;
    return processor;
  }
};
