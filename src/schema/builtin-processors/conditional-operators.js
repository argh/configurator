import { Executor, UNDEFINED_EXECUTOR } from "../executor/executor.js";
import { ResolverError } from '../schema-errors.js';
import { ConditionalExecutor } from '../executor/conditional-executor.js';
import { ValueProcessor } from '../value-processor/value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';

/**
 * @import {ValueProcessorDefinition} from '../value-processor/value-processor.js'
 */

/**
 * @param {string} keyword
 * @param {symbol[]} [flags]
 * @returns {function(any): ValueProcessor}
 * @package
 */
function generateBuilderFunction(keyword, flags) {

  return (args) => {

    /** @type {ValueProcessor} */
    let predicate;
    /** @type {ValueProcessor} */
    let success;
    /** @type {ValueProcessor} */
    let failure;

    if (Array.isArray(args)) {
      if (args.length > 3) {
        throw new ResolverError(`${keyword} array requires 0-3 processors [predicate, success, failure]`);
      }
      predicate = args[0];
      success = args[1];
      failure = args[2];
    }
    else if (typeof args === 'object' && args !== null) {
      predicate = args.predicate ?? args.condition ?? args.cond;
      success = args.success;
      failure = args.failure;
    }
    else if (args !== undefined) {
      throw new ResolverError(`${keyword} requires predicate/success/failure processors specified as an array or object`);
    }

    predicate ??= new ComposedValueProcessor(new Executor(), []);
    success ??= new ComposedValueProcessor(new Executor(), []);
    failure ??= new ComposedValueProcessor(UNDEFINED_EXECUTOR, '$undefined');

    const spec = {[`${keyword}`]: [predicate.spec, success?.spec, failure?.spec]}

    let description = `(${predicate.description ?? ''})?`;
    if (success.description) {
      description += `(${success.description})`;
    }
    if (failure.description) {
      description += `:(${failure.description})`
    }

    return new ComposedValueProcessor(
      new ConditionalExecutor(predicate, {success, failure}, flags),
      spec, description
    );
  }
}

/**
 * ## $if
 *
 * This is a conditional operator that evaluates a predicate for truthiness.
 *
 * If the predicate returns a truthy value, $if will invoke any provided success action
 * with the original input.  If not provided, the default success action will simply return the original input.
 *
 * If the predicate returns a falsey value or rejects/throws, $if will return the result of invoking the failure
 * action on the original input.  The default failure action will return undefined.
 *
 * This processor can act as a constraint if the success or failure actions throw when triggered.
 *
 * To pass the predicate results to the actions instead of the input, see $check.
 * To test for success rather than truthiness, see $gate.
 *
 * @type {ValueProcessorDefinition}
 */
export const IF_OPERATOR = {
  keyword: 'if',
  build: generateBuilderFunction('$if', [ConditionalExecutor.CHECK_TRUTHY])
};
/**
 * ## $gate
 *
 * This is a conditional operator that evaluates a predicate for whether it returns a defined value.
 *
 * If the predicate returns a defined value, $gate will return the result of invoking any provided success action
 * with the original input.  If not provided, the default success action will simply return the original input.
 *
 * If the predicate returns undefined or rejects/throws, $gate will return the result of invoking the failure
 * action on the original input.  The default failure action will return undefined.
 *
 * This processor can act as a constraint if the success or failure actions throw when triggered.
 *
 * To pass the original input to the actions instead of the predicate results, see $if.
 *
 * @type {ValueProcessorDefinition}
 */
export const GATE_OPERATOR = {
  keyword: 'gate',
  build: generateBuilderFunction('$gate',[ConditionalExecutor.CHECK_DEFINED])
};
/**
 * ## $check
 *
 * This is a conditional operator that evaluates a predicate for truthiness.
 *
 * If the predicate returns a truthy value, $check will return the result of invoking any provided success action
 * with the predicate result.  If not provided, the default success action will simply return the predicate result.
 *
 * If the predicate returns a falsey value or rejects/throws, $check will return the result of invoking the failure
 * action on the predicate result.  The default failure action will return undefined.  Since the predicate result
 * is already falsey, the failure action is best used to either return a default value or throw an error.
 *
 * This processor can act as a constraint if the success or failure actions throw when triggered.
 *
 * @type {ValueProcessorDefinition}
 */
export const CHECK_OPERATOR = {
  keyword: 'check',
  build: generateBuilderFunction('$check',[ConditionalExecutor.CHECK_TRUTHY, ConditionalExecutor.PASS_RESULT])
};
/**
 * ## $when
 *
 * This is a conditional operator that evaluates a predicate for whether it returns a defined value.
 *
 * If the predicate returns a defined value, $when will return the result of invoking any provided success action
 * with the predicate result.  If not provided, the default success action will simply return the predicate result.
 *
 * If the predicate returns undefined or rejects/throws, $when will return the result of invoking the failure
 * action on the predicate result.  The default failure action will return undefined.  Since the predicate result
 * is undefined, the failure action is best used to either return a default value or throw an error.
 *
 * This processor can act as a constraint if the success or failure actions throw when triggered.
 *
 * To check truthiness instead of defined/undefined, see $check.
 * To pass the original input to the actions instead of the predicate result, see $gate.
 *
 * @type {ValueProcessorDefinition}
 */
export const WHEN_OPERATOR = {
  keyword: 'when',
  build: generateBuilderFunction('$when',[ConditionalExecutor.CHECK_DEFINED, ConditionalExecutor.PASS_RESULT]),
};

/**
 * ## $try
 *
 * This is a conditional operator that evaluates a predicate for whether it throws/rejects.
 *
 * If the predicate does not throw, $try will return the result of invoking any provided success action
 * with the predicate result.  If not provided, the default success action will simply return the predicate result.
 *
 * If the predicate rejects/throws, $try will return the result of invoking the failure action with the error returned.
 * The default failure action will return undefined.  Since the predicate result is an error, the failure action is
 * best used to either intercept errors and return a default value, or to propagate or wrap the error.
 *
 * This processor can act as a constraint if the success or failure actions throw when triggered.
 *
 * @type {ValueProcessorDefinition}
 */

export const TRY_OPERATOR = {
  keyword: 'try',
  build: generateBuilderFunction('$try',[ConditionalExecutor.PASS_ERROR, ConditionalExecutor.PASS_RESULT]),
};

