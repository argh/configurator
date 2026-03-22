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
 * ### Parameters
 * - `predicate` (processor, optional): Evaluated for truthiness. If omitted, the input itself is used as the predicate.
 * - `success` (processor, optional): Invoked with the original input on truthy predicate result. Default: returns input as-is.
 * - `failure` (processor, optional): Invoked with the original input on falsey predicate result or throw. Default: returns undefined.
 *
 * Array form: `{$if: [predicate, success, failure]}`
 * Object form: `{$if: {predicate: ..., success: ..., failure: ...}}`
 * Aliases: `predicate` may also be written as `condition` or `cond`.
 *
 * ### Example
 * ```js
 * // Normalize an optional port — keep it if numeric, otherwise drop it
 * new Schema('object', {
 *   port: new Schema('number').normalizer({
 *     $if: ['$numeric', '$number', null]
 *   }),
 * })
 *
 * // Conditionally require an API key when a flag is set
 * new Schema('object', {
 *   useApiKey: new Schema('boolean'),
 *   apiKey: new Schema('string').validator({
 *     $if: [
 *       {$reference: 'useApiKey'},
 *       '$non-empty',
 *     ]
 *   }),
 * })
 * ```
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
 * ### Parameters
 * - `predicate` (processor, optional): Evaluated for defined-ness. If omitted, the input itself is tested.
 * - `success` (processor, optional): Invoked with the original input when predicate returns a defined value. Default: returns input as-is.
 * - `failure` (processor, optional): Invoked with the original input when predicate returns undefined or throws. Default: returns undefined.
 *
 * Array form: `{$gate: [predicate, success, failure]}`
 * Object form: `{$gate: {predicate: ..., success: ..., failure: ...}}`
 *
 * ### Example
 * ```js
 * // Only process the value through $uppercase if it was provided
 * new Schema('string').normalizer({
 *   $gate: ['$defined', '$uppercase']
 * })
 *
 * // Use the first resolvable property as a value
 * new Schema('object', {
 *   host: new Schema('string'),
 *   fallbackHost: new Schema('string'),
 * }).transformer({
 *   $gate: [{$property: 'host'}, {$property: 'host'}, {$property: 'fallbackHost'}]
 * })
 * ```
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
 * ### Parameters
 * - `predicate` (processor, optional): Evaluated for truthiness. The predicate result (not the original input) is passed to success/failure.
 * - `success` (processor, optional): Invoked with the predicate result on truthy outcome. Default: returns predicate result.
 * - `failure` (processor, optional): Invoked with the predicate result on falsey outcome or throw. Default: returns undefined.
 *
 * Array form: `{$check: [predicate, success, failure]}`
 * Object form: `{$check: {predicate: ..., success: ..., failure: ...}}`
 *
 * ### Example
 * ```js
 * // Extract and validate an environment key, returning the matched value or undefined
 * new Schema('string').transformer({
 *   $check: [
 *     {$match: /^(production|staging|development)$/},
 *   ]
 * })
 *
 * // Validate a regex match and throw on failure
 * new Schema('string').validator({
 *   $check: [
 *     {$match: /^\d{4}-\d{2}-\d{2}$/},
 *     null,
 *     () => { throw new Error('Expected YYYY-MM-DD date format') }
 *   ]
 * })
 * ```
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
 * ### Parameters
 * - `predicate` (processor, optional): Evaluated for defined-ness. The predicate result (not the original input) is passed to success/failure.
 * - `success` (processor, optional): Invoked with the predicate result when it is defined. Default: returns predicate result.
 * - `failure` (processor, optional): Invoked with the predicate result (undefined) when predicate returns undefined or throws. Default: returns undefined.
 *
 * Array form: `{$when: [predicate, success, failure]}`
 * Object form: `{$when: {predicate: ..., success: ..., failure: ...}}`
 *
 * ### Example
 * ```js
 * // Extract a nested value, providing a default when not found
 * new Schema('object').transformer({
 *   $when: [
 *     {$get: 'config.timeout'},
 *     null,
 *     () => 5000   // default 5s when config.timeout not set
 *   ]
 * })
 *
 * // Chain: extract the match groups object if the pattern matched, otherwise drop
 * new Schema('string').transformer({
 *   $when: [{$match: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/}]
 * })
 * ```
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
 * ### Parameters
 * - `predicate` (processor, optional): Executed and observed for throw/rejection.
 * - `success` (processor, optional): Invoked with the predicate result if it did not throw. Default: returns predicate result.
 * - `failure` (processor, optional): Invoked with the thrown error if the predicate threw. Default: returns undefined.
 *
 * Array form: `{$try: [predicate, success, failure]}`
 * Object form: `{$try: {predicate: ..., success: ..., failure: ...}}`
 *
 * ### Example
 * ```js
 * // Attempt JSON parsing, fall back to raw string on failure
 * new Schema('string').normalizer({
 *   $try: ['$json-decode', null, (err) => err.input]
 * })
 *
 * // Attempt to parse a number, silently drop value on error
 * new Schema('string').normalizer({
 *   $try: ['$number']
 * })
 * ```
 *
 * @type {ValueProcessorDefinition}
 */

export const TRY_OPERATOR = {
  keyword: 'try',
  build: generateBuilderFunction('$try',[ConditionalExecutor.PASS_ERROR, ConditionalExecutor.PASS_RESULT]),
};

