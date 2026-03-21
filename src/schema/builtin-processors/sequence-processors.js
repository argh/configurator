import { ConstraintError, ResolverError } from '../schema-errors.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { ValueProcessor } from '../value-processor/value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { SequenceExecutor } from '../executor/sequence-executor.js';
import { formatValue } from '../../errors.js';

/**
 * @import {ValueProcessorDefinition} from '../value-processor/value-processor.js'
 */

/**
 *
 * @param {string} keyword
 * @param {string} joiner
 * @param {(processors:ValueProcessor[], spec:any, description:string) => ValueProcessor} builder
 * @returns {function(*): *}
 * @package
 */
function generateBuilderFunction(keyword, joiner, builder) {
  return (args) => {

    let processors;
    if (Array.isArray(args)) {
      processors = args;
    }
    else if (typeof args === 'object' && args !== null) {
      processors = Object.values(args);
    }
    if (!Array.isArray(processors)) {
      throw new ResolverError(`${keyword} requires an array of processors`);
    }
    const spec = {[keyword]: processors.map(a => a.spec)};
    const descriptions = processors.map(c => c.description).filter((d) => d !== undefined);
    const description = descriptions.length > 1
                        ? descriptions.map(d => d.includes('&') ? `(${d})` : d).join(joiner)
                        : descriptions[0]

    return builder(processors, spec, description);
  }
}


/**
 * **Processor**: `$or`
 *
 * A constraint that checks whether any of the provided processors return a truthy value.
 *
 * Returns the first truthy value from the processors, or throws if none are truthy.
 *
 * See `$any` if you want to check for success (defined value) instead of truthiness
 *
 * @type {ValueProcessorDefinition}
 */
export const OR_CONSTRAINT = {
  keyword: 'or',
  build: generateBuilderFunction('$or', ' | ',
    (processors, spec, description) => (
      new ComposedValueProcessor(
        new ConditionalExecutor(
          new SequenceExecutor(processors, [
            SequenceExecutor.TRUTHY_CHECK,
            SequenceExecutor.ANY_CRITERIA,
            SequenceExecutor.RESULT_RETURN,
            SequenceExecutor.CAPTURE_ERRORS
          ]),
          {
            failure: (value) => {
              throw new ConstraintError(`None of the $or conditions ${formatValue(description)} matched`,{value});
            }
          },
          [ConditionalExecutor.CHECK_TRUTHY]
        ), spec, description)
    )
  )
};

/**
 * **Processor**: `$and`
 *
 * A constraint that checks whether all the provided processors return a truthy value.
 *
 * Returns the last truthy value from the processors, or throws if any are falsey.
 *
 * See `$all` if you want to check for success (defined value) instead of truthiness
 *
 * @type {ValueProcessorDefinition}
 */
export const AND_CONSTRAINT = {
  keyword: 'and',
  build: generateBuilderFunction('$and', ' & ',
    (processors, spec, description) => (
      new ComposedValueProcessor(
        new ConditionalExecutor(
          new SequenceExecutor(processors, [
            SequenceExecutor.TRUTHY_CHECK,
            SequenceExecutor.ALL_CRITERIA,
            SequenceExecutor.RESULT_RETURN,
            SequenceExecutor.CAPTURE_ERRORS
          ]),
          {
            failure: (value) => {
              throw new ConstraintError(`Not all $and conditions ${formatValue(description)} matched`, {value});
            }
          },
          [ConditionalExecutor.CHECK_TRUTHY]
        ), spec, description)
    )
  )
};

/**
 * **Processor**: `$any`
 *
 * A constraint that checks whether any of the provided processors return a defined value.
 *
 * Returns the first defined value from the processors, or throws if none returned a defined value.
 *
 * See `$or` if you want to check for truthiness instead of a defined value.
 *
 * @type {ValueProcessorDefinition}
 */
export const ANY_CONSTRAINT = {
  keyword: 'any',
  build: generateBuilderFunction('$any', ' ∧ ',
    (processors, spec, description) => (
      new ComposedValueProcessor(
        new ConditionalExecutor(
          new SequenceExecutor(processors, [
            SequenceExecutor.SUCCESS_CHECK,
            SequenceExecutor.ANY_CRITERIA,
            SequenceExecutor.RESULT_RETURN,
            SequenceExecutor.CAPTURE_ERRORS
          ]),
        {
          failure: (value) => {
            throw new ConstraintError(`None of the $any conditions ${formatValue(description)} succeeded`, {value});
          }
        },
        [ConditionalExecutor.CHECK_DEFINED]
        ), spec, description)
    )
  )
};

/**
 * **Processor**: `$all`
 *
 * A constraint that checks whether all the provided processors return a defined value.
 *
 * Returns the last defined value returned from the processors, or throws if any returned undefined or threw an error.
 *
 * See `$and` if you want to check for truthiness instead of defined values.
 *
 * @type {ValueProcessorDefinition}
 */
export const ALL_CONSTRAINT = {
  keyword: 'all',
  build: generateBuilderFunction('$all', ' · ',
    (processors, spec, description) => (
      new ComposedValueProcessor(
        new ConditionalExecutor(
          new SequenceExecutor(processors, [
            SequenceExecutor.SUCCESS_CHECK,
            SequenceExecutor.ALL_CRITERIA,
            SequenceExecutor.RESULT_RETURN,
            SequenceExecutor.CAPTURE_ERRORS
          ]),
          {
            failure: (value) => {
              throw new ConstraintError(`Not all $all conditions ${formatValue(description)} succeeded`, {value})
            }
          },
          [ConditionalExecutor.CHECK_DEFINED]
        ), spec, description)
    )
  )

};

/**
 * **Processor**: `$first`
 *
 * An operator that returns the first defined value successfully returned from a sequence of processors.
 *
 * Unlike `$any`, no exception is thrown if there are no defined results, it simply returns `undefined`.
 *
 * There is no truthy variant of `$first`, as there generally isn't much value in differentiating which
 * truthy value to return; use constructs like `{$if: {$or: [...]}}` to wrap truthy sequence constraints as operators.
 * `$first` is basically an alias for `{$gate: {$any: [...]}}`.
 *
 * @type {ValueProcessorDefinition}
 */
export const FIRST_OPERATOR = {
  keyword: 'first',
  build: generateBuilderFunction('$first', ' ?? ',
    (processors, spec, description) => (
      new ComposedValueProcessor(
        new ConditionalExecutor(
          new SequenceExecutor(processors, [
            SequenceExecutor.DEFINED_CHECK,
            SequenceExecutor.ANY_CRITERIA,
            SequenceExecutor.RESULT_RETURN,
            SequenceExecutor.CAPTURE_ERRORS
          ]),
          {},
          [ConditionalExecutor.CHECK_DEFINED, ConditionalExecutor.PASS_RESULT]
        ), spec, description)
    )
  )
};