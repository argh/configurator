import { CompiledSchema } from "../compiled-schema.js";

/**
 *
 * @param {CompiledSchema} schema
 * @returns {string}
 * @package
 */
export function formatArgumentType(schema) {

  if (schema.metadata.valueDescription) {
    return schema.metadata.valueDescription;
  }

  let argumentTypeString;
  if (schema.isArray && schema.hasChildren) {
    const props = Array.from(schema.propertyEntries)
                        .sort((a, b) => {
                          if (a[0] === '*') return 1;
                          if (b[0] === '*') return -1;
                          return a[0].localeCompare(b[0], undefined, {numeric: true});
                        })
                        .map(e => e[1]);


    argumentTypeString = props.map(s =>
    {
      let propFormat = formatArgumentType(s)
      if (!s.required && (propFormat.length > 2) && propFormat.charAt(0) === '[' && propFormat.charAt(propFormat.length - 1) === ']') {
        propFormat = propFormat.slice(1, propFormat.length - 1);
      }
      return propFormat;
    }).join(', ')

    if (schema.hasWildcard) {
      argumentTypeString += '...';
    }

    if (schema.metadata.validatorDescription) {
      if (argumentTypeString && !argumentTypeString.includes(schema.metadata.validatorDescription)) {
        argumentTypeString += ` {${schema.metadata.validatorDescription}}`;
      }
    }
  }
  else {
    if (Array.isArray(schema.options.values) && schema.options.values.length > 0) {
      argumentTypeString = schema.options.values.map(v => `${v}`)
                                 .sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).join('|');
    }
    else {
      argumentTypeString = schema.metadata.valueName ?? (schema.isArray? '' : schema.options.type);

      if (schema.metadata.validatorDescription) {
        if (!argumentTypeString || (argumentTypeString === schema.options.type)) {
          argumentTypeString = schema.metadata.validatorDescription;  // overwrite basic "type names"
        }
        else {
          argumentTypeString = `${argumentTypeString} {${schema.metadata.validatorDescription}}`;
        }
      }
    }
    if (argumentTypeString === undefined) {
      argumentTypeString = 'value';
    }
    if (schema.isArray && !argumentTypeString.includes('...')) {
      argumentTypeString += '...';
    }
  }
  return argumentTypeString;
}