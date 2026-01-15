import { ResolverError, SchemaError } from '../../errors.js';

/**
 * **Processor**: `$property`
 *
 * Extracts a named property value from an object. This operator is useful for accessing
 * nested properties or extracting specific fields during processing pipelines.
 *
 * Returns `undefined` if the current value is not an object or if the property doesn't exist.
 * Throws a `SchemaError` if the specified property name is not defined in the schema.
 *
 * @example
 * ```javascript
 * // Extract a specific property during normalization
 * Schema.create('object', {
 *   metadata: Schema.create('object', {
 *     userId: Schema.create('string'),
 *     timestamp: Schema.create('number')
 *   })
 * }).normalizer({$property: 'metadata'})
 *
 * // Use in a transform pipeline to extract and process a field
 * Schema.create('object', {
 *   rawData: Schema.create('string'),
 *   processedData: Schema.create('string')
 * }).transformer({$property: 'rawData'})
 *
 * // Extract property for conditional logic
 * Schema.create('object', {
 *   type: Schema.create('string'),
 *   config: Schema.create('object')
 * }).checkCondition({$property: 'type'})
 * ```
 *
 * **Parameters**:
 * - `propertyName` (string, required): The name of the property to extract. Must be defined in the schema.
 *
 * **Input**: `{foo: 'bar', baz: 123}` with `{$property: 'foo'}` → **Output**: `'bar'`
 *
 * @type {import("../types.js").ValueProcessorDefinition}
 */
export const PROPERTY_OPERATOR = {
  keyword: 'property',
  builder: (propertyName) => {

    if (propertyName === undefined) {
      // todo - expand contract with spec compilation to pass a schema so we can verify property values earlier
      throw new ResolverError('$property expects a property name')
    }

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (current, configuration, schema) => {
        if (schema.getPropertySchema(propertyName) === undefined) {
          throw new SchemaError(`Unknown property ${propertyName}`);
        }
        return (typeof current === 'object' && current !== null)? current[propertyName] : undefined;
      },
      description: `${propertyName}`
    };
  }
};
