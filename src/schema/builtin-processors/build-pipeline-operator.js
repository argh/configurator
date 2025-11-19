import { ResolverError } from '../../errors.js';

/**
 * @import {ValueProcessorDefinition, ProcessorSpec, CompiledSpec, ProcessorSpecCompiler, SchemaValueProcessor, CompiledValueProcessorDefinition} from '../types.js'
 */

/**
 * Build the $and operator from provided args - all processors must pass
 * @type {ValueProcessorDefinition}
 */
export const PIPELINE_OPERATOR = {
  /**
   * @param {Array<ProcessorSpec>} args
   * @param {ProcessorSpecCompiler} compileSpec
   * @returns {CompiledValueProcessorDefinition}
   */
  build: (args, compileSpec) => {
    if (!Array.isArray(args)) {
      throw new ResolverError('$pipeline requires an array of processors');
    }

    /** @type {Array<ProcessorSpec>} */
    const processors = args;

    const compiled = processors.map(spec => compileSpec(spec));

    const descriptions = compiled.map(c => c.description ?? '').filter(Boolean);

    return ({
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, schema, path, options) => {
        let v = value;
        for (const {processor} of compiled) {
          v = await processor(v, configuration, schema, path, options);
        }
        return v;
      },
      description: descriptions.length > 1
                   ? descriptions.map(d => (d.includes('|') || d.includes('&')) ? `(${d})` : d).join(' >> ')
                   : descriptions[0]
    });
  }
};
