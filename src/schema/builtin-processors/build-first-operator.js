import { ResolverError } from '../../errors.js';

/**
 * @import {ValueProcessorDefinition, ProcessorSpec, CompiledSpec, ProcessorSpecCompiler, SchemaValueProcessor, CompiledValueProcessorDefinition} from '../types.js'
 */

/**
 * **Processor**: `$first`
 *
 * Executes a sequence of processors in order.  The output from the first processor that executes
 * successfully is returned.  If nothing succeeds, the processor returns undefined.
 *
 * **Behavior**: Processors execute left-to-right. If any processor throws an error, the pipeline
 * stops and the error propagates.
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const FIRST_OPERATOR = {
  keyword: 'first',
  /**
   * @param {Array<ProcessorSpec>} args
   * @param {ProcessorSpecCompiler} compileSpec
   * @returns {CompiledValueProcessorDefinition}
   */
  builder: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$first requires an array of processors');
    }

    /** @type {Array<ProcessorSpec>} */
    const processors = args;

    const compiled = processors.map(spec => compileSpec(spec));

    const descriptions = compiled.map(c => c.description ?? '').filter(Boolean);

    return ({
      spec: processors,
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, schema, path, options) => {
        for (const {processor} of compiled) {
          try {
            return await processor(value, configuration, schema, path, options);
          }
          catch (error) {
            // ignored
          }
        }
        return undefined;
      },
      description: descriptions.length > 1
                   ? descriptions.map(d => (d.includes('|') || d.includes('&')) ? `(${d})` : d).join(' ?? ')
                   : descriptions[0]
    });
  }
};
