import { ResolverError } from '../../errors.js';

/**
 * @import {ValueProcessorDefinition, ProcessorSpec, CompiledSpec, ProcessorSpecCompiler, SchemaValueProcessor, CompiledValueProcessorDefinition} from '../types.js'
 */

/**
 * **Processor**: `if`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const IF_OPERATOR = {
  keyword: 'if',
  /**
   * @param {Array<ProcessorSpec>|{[key:string]:ProcessorSpec}} args
   * @param {ProcessorSpecCompiler} compileSpec
   * @returns {CompiledValueProcessorDefinition}
   */
  builder: (args, compileSpec) => {

    let condDef;
    let thenDef;
    let elseDef;

    if (Array.isArray(args)) {
      if (args.length === 0 || args.length > 3) {
        throw new ResolverError('$if requires an array of up to three processors (condition, then, else)');
      }
      condDef = compileSpec(args[0] ?? (v => v));
      thenDef = compileSpec(args[1] ?? (v => v));
      elseDef = compileSpec(args[2] ?? (v => v));
    }
    else if (typeof args === 'object' && args !== null) {
      if (args.condition === undefined && args.cond === undefined) {
        throw new ResolverError('$if object requires a condition keyword');
      }
      condDef = compileSpec(args.condition ?? args.cond ?? (v => v));
      thenDef = compileSpec(args.then ?? (v => v));
      elseDef = compileSpec(args.else ?? (v => v));
    }
    else {
      throw new ResolverError('$if must be either be an array or object');
    }

    const compiled = [condDef, thenDef, elseDef];
    const descriptions = compiled.map(c => c.description ?? '');

    let description = `(${descriptions[0]})?`;
    if (descriptions[1]) {
      description += `(${descriptions[1]})`;
    }
    if (descriptions[2]) {
      description += `:(${descriptions[2]})`
    }

    return ({
      spec: args,
      /** @type {import('../types.js').SchemaValueProcessor<any>} */
      processor: async (value, configuration, location, options) => {

        let conditionResult = false;
        try {
          conditionResult = await condDef.processor(value, configuration, location, options);
        }
        catch (error) {
          // ignore;
        }
        if (conditionResult) {
          return await thenDef.processor(value, configuration, location, options);
        }
        else {
          return await elseDef.processor(value, configuration, location, options);
        }
      },
      description
    });
  }
};
