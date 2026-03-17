import { CompiledSchema } from "../compiled-schema.js";
import { SchemaCompiler } from "../schema-compiler.js";
import { SchemaLocation } from "../schema-location.js";
import { SchemaCompilationError } from '../schema-errors.js';
import { isEmpty } from '../../utils.js';

/**
 *
 * @param {CompiledSchema} cs
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {object} transformOptions
 * @returns {Promise<CompiledSchema>}  // fixme - fix normalize step to not require await!
 * @this {SchemaCompiler}
 */
export async function normalizeValues(cs, _, location, transformOptions) {

  if (isEmpty(cs.options.values)) {
    return cs;
  }
  const valueSet = new Set();

  for (const value of cs.options.values ?? []) {
    // CAUTION: do NOT pass the transform location (which captures the *schema schema* to the normalize call (the *output* schema)!
    const normalizedValue = await cs.normalizeValue(value);
    if (normalizedValue === undefined) {
      throw new SchemaCompilationError(`Undefined after normalizing`, {value, location});
    }
    valueSet.add(normalizedValue);
  }
  if (valueSet.size) {
    cs.options.values = [...valueSet];
  }

  return cs;
}