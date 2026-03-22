import { ResolverError, SchemaError } from '../schema-errors.js';

/**
 * ## $property
 *
 * Extracts a named property value from an object. This operator is useful for accessing
 * nested properties or extracting specific fields during processing pipelines.
 *
 * Returns `undefined` if the current value is not an object or if the property doesn't exist.
 * Throws a `SchemaError` if the specified property name is not defined in the schema.
 *
 * ### Parameters
 * - `propertyName` (string, required): The name of the property to extract. Must be defined in the schema.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}
 */
export const PROPERTY_OPERATOR = {
  keyword: 'property',
  parameters: [{parameter: 'name', required: true}],
  process: (value, _target, location, options) => {
    const propertyName = options.args.name;
    if (propertyName === undefined) {
      throw new SchemaError('$property expects a property name', {location})
    }
    if (location.schema.getPropertySchema(propertyName) === undefined) {
      throw new SchemaError(`Unknown $property ${propertyName}`, {location});
    }
    return (typeof value === 'object' && value !== null)? value[propertyName] : undefined;
  }
};
