import { ResolverError } from '../../errors.js';

/**
 * @import {ValueProcessorDefinition, ProcessorSpec, CompiledSpec, ProcessorSpecCompiler, SchemaValueProcessor, CompiledValueProcessorDefinition} from '../types.js'
 */

/**
 * **Processor**: `$pipeline`
 *
 * Executes a sequence of processors in order, passing the output of each processor
 * as input to the next. The final processor's output becomes the result.
 *
 * **Note**: Handler arrays (normalizers, validators, etc.) implicitly create pipelines,
 * so this processor is rarely used directly. It's primarily used internally by the
 * schema compiler to aggregate handler arrays into single compiled processors.
 *
 * @example
 * ```javascript
 * // Explicit pipeline (rarely needed - prefer handler arrays)
 * Schema.create('string').validator({
 *   $pipeline: ['$trim', '$lowercase', {$length: {min: 3}}]
 * })
 *
 * // Preferred: Use handler arrays (creates implicit pipeline)
 * Schema.create('string')
 *   .validator('$trim')
 *   .validator('$lowercase')
 *   .validator({$length: {min: 3}})
 *
 * // Normalize phase pipeline (trim then convert case)
 * Schema.create('string').normalizer({
 *   $pipeline: ['$trim', '$lowercase']
 * })
 *
 * // Transform pipeline with multiple operations
 * Schema.create('number').transformer({
 *   $pipeline: [{$round: {precision: 2}}, {$range: {min: 0, max: 100}}]
 * })
 * ```
 *
 * **Parameters**:
 * - `processors` (Array<ProcessorSpec>, required): Array of processor specifications to execute in sequence.
 *   Each element can be a string keyword (e.g., `'$trim'`), a parameterized processor object
 *   (e.g., `{$range: {min: 0}}`), a RegExp, or a function.
 *
 * **Behavior**: Processors execute left-to-right. If any processor throws an error, the pipeline
 * stops and the error propagates. Each processor receives the output of the previous processor
 * as its input value.
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const PIPELINE_OPERATOR = {
  keyword: 'pipeline',
  /**
   * @param {Array<ProcessorSpec>} args
   * @param {ProcessorSpecCompiler} compileSpec
   * @returns {CompiledValueProcessorDefinition}
   */
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$pipeline requires an array of processors');
    }

    /** @type {Array<ProcessorSpec>} */
    const processors = args;

    const compiled = processors.map(spec => compileSpec(spec));

    const descriptions = compiled.map(c => c.description ?? '').filter(Boolean);

    return ({
      spec: processors,

      processor: /** @type {import('../types.js').SchemaValueProcessor<any>} */
        (async (value, configuration, location, options) => {
        const allowUndefined = location.schema?.options.allowUndefined ?? options?.allowUndefined ?? false;

        let v = value;
        for (const {processor} of compiled) {
          if ((v === undefined && !allowUndefined) || v === null) {
            return v;
          }
          v = await processor(v, configuration, location, options);
        }
        return v;
      }),
      description: descriptions.length > 1
                   ? descriptions.map(d => (d.includes('|') || d.includes('&')) ? `(${d})` : d).join(' >> ')
                   : descriptions[0]
    });
  }
};
