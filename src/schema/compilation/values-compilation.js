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
 * @returns {CompiledSchema|Promise<CompiledSchema>}
 * @this {SchemaCompiler}
 */
export function normalizeValues(cs, _, location) {
  const values = cs.options.values ?? [];
  if (isEmpty(cs.options.values)) {
    return cs;
  }

  const valueSet = new Set();

  const handle = (value) => {
    if (value === undefined) {
      throw new SchemaCompilationError(`Undefined after normalizing`, {value, location});
    }
    valueSet.add(value);
  }
  const done = () => {
    if (valueSet.size) {
      cs.options.values = [...valueSet];
    }
    return cs;
  }

  const resume = async (vi) => {

    while (vi < values.length) {
      handle(await cs._normalizeValue(values[vi++]));
    }
    return done();
  }


  let vi = 0;

  while (vi < values.length) {
    const result = cs._normalizeValue(values[vi++]);
    if (result instanceof Promise) {
      return result.then(resolved => { handle(resolved); return resume(vi) })
    }
    handle(result);
  }
  return done();

}