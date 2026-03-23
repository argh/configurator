import { SchemaError } from '../schema-errors.js';

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
 * - `name` (string, required): The name of the schema-defined property to extract from the input object.
 *   The property must be declared in the current schema; use `$get` for arbitrary path access without
 *   schema awareness.
 *
 * ### Example
 * ```js
 * // Conditionally require 'apiKey' only when 'useApiKey' is true
 * new Schema('object', {
 *   useApiKey: new Schema('boolean'),
 *   apiKey: new Schema('string').validator({
 *     $if: [{$property: 'useApiKey'}, '$non-empty']
 *   }),
 * })
 *
 * // Discriminate a union using a schema property value
 * new Schema('object', {
 *   type: new Schema('string'),
 *   config: new Schema('any'),
 * }).discriminator({$property: 'type'})
 * ```
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
