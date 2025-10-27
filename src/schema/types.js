/**
 * @typedef {Object} ISchema
 * @property {string} [base] - Base schema name for extension
 * @property {string} [name] - Schema name
 * @property {ISchema} [parent] - Parent schema in hierarchy
 * @property {string} path - Path to this schema in the schema hierarchy
 * @property {ISchemaProperties} properties - Schema properties
 * @property {ISchemaOptions} options - Schema options
 * @property {ISchemaMetadata} metadata - Schema metadata
 * @property {ISchemaUnion} unionSchemas - Union schema definitions
 * @property {(schema:ISchema) => SchemaData|undefined} toData - Serialize schema to plain object
 */

import { CompiledSchema } from "./compiled-schema.js";

/**
 * @template TReturn
 * @callback SchemaValueFunction
 * @param {any} value
 * @param {Object|Array<any>} configuration
 * @param {CompiledSchema} schema
 * @param {String} path
 * @param {Object} [options]
 * @returns {TReturn}
 */

/**
 * @template TReturn
 * @callback AsyncSchemaValueFunction
 * @param {any} value
 * @param {Object|Array<any>} configuration
 * @param {CompiledSchema} schema
 * @param {String} path
 * @param {Object} [options]
 * @returns {Promise<TReturn>}
 */

/**
 * @typedef {Object} ISchemaMetadataCommon
 * @property {string} [description] - help text description of the property; used by CommandLineSource
 * @property {string} [valueName] - help text type name of the property value; used by CommandLineSource
 * @property {string} [valueDescription] - help text description of the property value; used by CommandLineSource
 * @property {string} [flagHint] - request a specific flag character; used by CommandLineSource
 * @property {boolean} [advanced] - filter from basic help text; used by CommandLineSource
 * @property {boolean} [hidden] - hide from help; used by CommandLineSource
 * @property {boolean} [general] - mark this field for CommandLineSource to be used without a flag or option
 * @property {string} [parserTypeHint] - set to base/primitive types to help source parsers interpret values
 * @property {boolean} [omitFromSerialize] - set to true to omit this schema's value when serializing
 */

/** @typedef {ISchemaMetadataCommon & {[key:string]: any}} ISchemaMetadata */

///** @typedef {string} BiteMe */

///** @typedef {ISchemaMetadataCommon & {[key:string]: any}} ISchemaMetadata1 */

/** @typedef {"any"|"string"|"number"|"boolean"|"bigint"|"symbol"|"object"|"array"|"function"|"null"} SchemaFundamentalType */

 /**
  * @typedef {Object} ISchemaOptionsCommon
  * @property {SchemaFundamentalType} [type] - should only be set on the core types supported by the schema
  * @property {SchemaValueFunction<any>} [normalizer] - ensure value is of correct shape.
  * @property {SchemaValueFunction<any>|AsyncSchemaValueFunction<any>} [transformer] - value resolver - map input value to output value.
  * @property {SchemaValueFunction<any>|AsyncSchemaValueFunction<any>|string|RegExp|object} [validator] - validator specification.
  * @property {SchemaValueFunction<any>|AsyncSchemaValueFunction<any>} [serializer] - convert a validated input to serialized form
  * @property {SchemaValueFunction<boolean>|AsyncSchemaValueFunction<any>|boolean} [condition] - conditional check whether to process this schema
  * @property {SchemaValueFunction<any>|AsyncSchemaValueFunction<any>|string} [discriminator] - function or property name that returns a union discriminator
  * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
  * @property {boolean} [allowDeepAssignment] - whether to allow deep assignment of values to this schema; defaults to false.
  * @property {boolean} [strict] - whether to do strict typechecking (defaults to true; must be explicitly false to be "lax")
  * @property {boolean} [inherit] - disallow direct assignment; value will be inherited from a parent
  * @property {boolean} [required] - flag indicating whether this field is required
  * @property {boolean} [literal] - flag indicating that this field always returns the option value
  * @property {string} [context] - triggers value to be copied to the context field with this name
  * @property {any} [default] - default value
  * @property {Array<any>} [values] - list of legal input values for this field
  * @property {boolean} [selector] - true if this schema acts as a selector
  * @property {boolean|string} [selection] - this schema activates if the selector matches the value, or matches this prop name if true
  */

/** @typedef {ISchemaOptionsCommon & {[key:string]: any}} ISchemaOptions */

/** @typedef {Object} ISchemaMetadataAttributesCommon
  * @property {string} [_description] - help text description of the property; used by CommandLineSource
 * @property {string} [_valueName] - help text type name of the property value; used by CommandLineSource
 * @property {string} [_valueDescription] - help text description of the property value; used by CommandLineSource
 * @property {string} [_flagHint] - request a specific flag character; used by CommandLineSource
 * @property {boolean} [_advanced] - filter from basic help text; used by CommandLineSource
 * @property {boolean} [_hidden] - hide from help; used by CommandLineSource
 * @property {boolean} [_general] - mark this field for CommandLineSource to be used without a flag or option
 * @property {string} [_parserTypeHint] - set to base/primitive types to help source parsers interpret values
 * @property {boolean} [_omitFromSerialize] - set to true to omit this schema's value when serializing
 */

/** @typedef {ISchemaOptionsCommon & ISchemaMetadataAttributesCommon & {[key:string]: any}} ISchemaAttributes */

/**
 * @typedef {Object.<string, ISchema>} ISchemaProperties
 */

/**
 * @typedef {Object.<any, ISchema>} ISchemaUnion
 */

/**
 * @typedef {Object} SchemaData
 * @property {string} [base]
 * @property {Object.<string,SchemaData>} [properties]
 * @property {Object.<string,any>} [metadata]
 * @property {Object.<string,any>} [options]
 * @property {Object.<any,SchemaData>} [unionSchemas]
 */

export {}; // Make this a module