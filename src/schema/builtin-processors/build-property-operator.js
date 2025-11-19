import { ResolverError, SchemaError } from '../../errors.js';

/**
 * Build the $property operator - read a property from the current value
 * @type {import("../types.js").ValueProcessorDefinition}
 */
export const PROPERTY_OPERATOR = {
  build: (propertyName) => {

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
      }
    };
  }
};
