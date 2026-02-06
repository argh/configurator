import { CompiledSchema } from "../compiled-schema.js";
import { SchemaLocation } from "../schema-location.js";

import { formatArgumentType } from '../helpers/format.js';

/**
 * @param {CompiledSchema} schema
 * @param {any} _
 * @param {SchemaLocation} location
 * @param {Object} options
 * @returns {Promise<CompiledSchema>}
 */
export async function populateMetadata(schema, _, location, options) {

  /*
  dst.handlers[handlerName] = [compiledDefinition];

  if (descriptionMetadata && !dst.metadata[descriptionMetadata] && compiledDefinition.description) {
    dst.metadata[descriptionMetadata] = compiledDefinition.description;
  }
  */

  if (!schema.metadata.validatorDescription && schema.handlers.validators?.length) {
    const descriptions = schema.handlers.validators.map(vd => vd.description ?? '').filter(Boolean);
    // this is used below in formatArgumentType...
    schema.metadata.validatorDescription = descriptions.length > 1
                                           ? descriptions.map(d => (d.includes('|') || d.includes('&')) ? `(${d})` : d).join(' >> ')
                                           : descriptions[0];
  }

  if (!schema.metadata.valueDescription) {
    const valueDescription = formatArgumentType(schema);
    schema.metadata.valueDescription = schema.required ? `<${valueDescription}>` : `[${valueDescription}]`;
  }
  if (!schema.metadata.valueName) {
    schema.metadata.valueName = schema.metadata.parserTypeHint ?? 'value';
  }
  return schema;
}
