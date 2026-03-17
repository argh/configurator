import { ConfiguratorError } from '../errors.js';
import { SchemaLocation } from "./schema-location.js";

export class SchemaError extends ConfiguratorError {
  /**
   * @param {string} message
   * @param {object} [data]
   * @param {Error|any} [data.cause]
   * @param {SchemaLocation} [data.location]
   * @param {string} [data.path]
   * @param {string|number} [data.property]
   * @param {any} [data.value]
   * @param {number} [data.code]
   * @param {Array<Error>} [data.errors]
   * @param {boolean} [preserveStack]
   */
  constructor(message, data, preserveStack = false) {
    if (data?.location !== undefined) {
      const {location, ...d} = data;
      d.path = location.path;
      data = d;
    }
    super(message, data, preserveStack);
  }

}

export class ConstraintError
  extends SchemaError {}

export class ProcessorError
  extends SchemaError {}

export class ValidationError
  extends SchemaError {}

export class NormalizeError
  extends SchemaError {}

export class TransformError
  extends SchemaError {}

export class SerializeError
  extends SchemaError {}

export class UnionResolutionError
  extends SchemaError {}

export class ResolverError
  extends ConfiguratorError {}

export class SchemaCompilationError
  extends SchemaError {}