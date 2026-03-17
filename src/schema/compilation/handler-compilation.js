import { CompiledSchema } from "../compiled-schema.js";
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";

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
  for (const handler of Object.keys(cs.handlers)) {
    cs._setValueProcessor(handler, this.resolver.compileValueProcessorSpec({$pipeline: cs.handlers[handler]}, true));
  }
  return cs;
}