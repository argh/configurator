import { CompiledSchema } from "../compiled-schema.js";
import { SchemaLocation } from "../schema-location.js";
import { SchemaCompilationError, SchemaError } from '../schema-errors.js';

// TODO - Consider making selection values default to '$name' rather than using true as a signal.
//        (This could enable making the synthesized condition be an arbitrary value processor pipeline!)

/**
 * @param {CompiledSchema} inputSchema
 * @param {any} _
 * @param {SchemaLocation} location
 * @returns {Promise<CompiledSchema>}
 */
export async function populateChildSelectorValues(inputSchema, _, location) {
//    if (!inputSchema.isSelector || inputSchema.hasValues) {
//      return inputSchema;
//    }

  const selectorProperties = [];
  const selectionProperties = [];
  for (const e of inputSchema.propertyEntries) {
    if (e[1].isSelector) {
      selectorProperties.push(e);
    }
    if (e[1].isSelection) {
      selectionProperties.push(e);
    }
  }

  if (selectorProperties.length === 0 && selectionProperties.length === 0) {
    return inputSchema;
  }

  if (selectorProperties.length > 1) {
    // todo - allow multiple selector/selection sets in a single schema?  (can always get same effect manually, though)
    throw new SchemaCompilationError(
      `Schema multiple properties marked as selectors: ${selectorProperties.map(p => p[0]).join(', ')}`,
      {location});
  }
  const selectorPropertyName = selectorProperties[0][0];
  const selectorPropertySchema = selectorProperties[0][1];

  const selectorPropertyLocation = location.relative(`properties.${selectorPropertyName}`);

  if (selectionProperties.length === 0) {
    throw new SchemaCompilationError(
      `Schema has selector at property ${selectorPropertyName} but no selections`, {location});
  }

  const existingSelectorValueSet = new Set([...selectorPropertySchema.values ?? []]);
  const selectionValueSet = new Set();

  for (const selectionProperty of selectionProperties) {
    const selectionPropertyName = selectionProperty[0];
    const selectionPropertySchema = selectionProperty[1];
    const selectionPropertyLocation = location.relative(`properties.${selectionPropertyName}`);

    let selectionValue = selectionPropertySchema.selection;
    if (selectionValue === true) {
      selectionValue = selectionPropertyName;
    }

    if (existingSelectorValueSet.size && !existingSelectorValueSet.has(selectionValue)) {
      throw new SchemaCompilationError(
        `Existing selector schema values {${[...existingSelectorValueSet].join('|')}} are missing selection`, {value: selectionValue,
          location: selectorPropertyLocation});
    }

    const selectorValue = await selectorPropertySchema.normalizeValue(selectionValue);
    selectionValueSet.add(selectorValue);
  }

  if (!selectorPropertySchema.hasValues) {
    if (selectorPropertySchema.isUnionKey) {
      throw new SchemaCompilationError(
        'Cannot populate values for a schema that is both a selector and a union key', {location: selectorPropertyLocation}
      );
    }
    selectorPropertySchema.options.values = [...selectionValueSet].sort();
  }
  return inputSchema;
}

