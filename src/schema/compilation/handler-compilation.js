import { CompiledSchema } from "../compiled-schema.js";
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { isEmpty } from '../../utils.js';

/**
 *
 * @param {CompiledSchema} cs
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {object} transformOptions
 * @returns {CompiledSchema}
 * @this {SchemaCompiler}
 */
export function compileHandlers(cs, _, location, transformOptions) {
  const compiler = this;
  for (const handler of Object.keys(cs.handlers)) {
    const h = cs.handlers[handler];
    if (!isEmpty(h)) {
      cs._setValueProcessor(handler,
        this.resolver.compileValueProcessorSpec(
          compiler,
          h.length === 1? h[0] : {$pipeline: h},
          true));
    }
  }
  return cs;
}