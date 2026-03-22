import { SchemaError } from '../schema-errors.js';
import { ParallelExecutor } from '../executor/parallel-executor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';
import { map } from '../../utils.js';

/** @import {ValueProcessorDefinition} from '../value-processor/value-processor.js' */

/**
 * ## $parallel
 *
 * Applies an array of processors concurrently to the same input value, returning an array
 * of all results in the same order as the processors.
 *
 * When all processors are synchronous, execution is sequential and the result is a plain array.
 * When any processor is asynchronous, all are run via `Promise.all`, giving true concurrent
 * execution — useful for I/O-bound processors such as HTTP fetches or secret lookups.
 *
 * Errors propagate immediately (fail-fast). Wrap individual processors in `$gate` or `$try`
 * to trap errors and return a fallback instead.
 *
 * ### Parameters
 * - `processors` (Array, required): Array of processor specifications to run concurrently.
 *
 * **Examples**:
 * ```js
 * // Fan out to two transforms and collect both results
 * schema.transformer({$parallel: ['$uppercase', '$trim']})
 * // → ['HELLO', 'hello'] for input '  hello  '
 *
 * // Concurrent async lookups
 * schema.transformer({$parallel: [fetchFlags, fetchPermissions]})
 * // → [flagsResult, permissionsResult]
 * ```
 *
 * @type {ValueProcessorDefinition}
 */
export const PARALLEL_OPERATOR = {
  keyword: 'parallel',
  build: (args) => {
    // The resolver's map() utility wraps scalar specs into single-element arrays before
    // reaching build(), so {$parallel: '$trim'} arrives as [compiled_trim] and is valid.
    // Only plain-object args (e.g. {$parallel: {key: spec}}) arrive as non-arrays.
    if (!Array.isArray(args)) {
      throw new SchemaError('$parallel requires an array of processors');
    }

    const spec = {$parallel: map(args, arg => arg.spec)};
    const descriptions = args.map(arg => arg.description).filter(d => d !== undefined);
    const description = descriptions.length > 0
      ? descriptions.map(d => /[|&>·∧ ]/.test(d) ? `(${d})` : d).join(' ⊗ ')
      : undefined;

    return new ComposedValueProcessor(new ParallelExecutor(args), spec, description);
  }
};
