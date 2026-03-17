/**
 * @typedef {object} ISchema
 * @property {string} [base] - Base schema name for extension
 * @property {ISchemaProperties} properties - Schema properties
 * @property {ISchemaOptions} options - Schema options
 * @property {ISchemaMetadata} metadata - Schema metadata
 * @property {ISchemaHandlers} handlers - Schema handlers
 * @property {ISchemaUnion} unionSchemas - Union schema definitions
 * @property {(schema:ISchema) => SchemaData|undefined} toData - Serialize schema to plain object
 */

import { TraversalContext, TraversalState } from './traversal/index.js';

import { Executor } from './executor/executor.js';

/** @import { CompiledSchema } from './compiled-schema.js' */
/** @import { SchemaLocation } from './schema-location.js' */
/** @import { ValueProcessorSpec } from './value-processor/value-processor.js' */


/**
 * @typedef {object} ISchemaMetadataCommon
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


///** @typedef {ISchemaMetadataCommon & {[key:string]: any}} ISchemaMetadata1 */

/** @typedef {"any"|"string"|"number"|"boolean"|"bigint"|"symbol"|"object"|"array"|"function"|"buffer"|"null"} SchemaFundamentalType */

 /**
  * @typedef {object} ISchemaOptionsCommon
  * @property {SchemaFundamentalType} [type] - should only be set on the core types supported by the schema
  * @property {function(string,ISchema):void} [compileHook] - a function called during schema compilation
  * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
  * @property {boolean} [strict] - whether to do strict typechecking (defaults to true; must be explicitly false to be "lax")
  * @property {boolean} [reference] - disallow direct assignment; value will be inherited from a parent
  * @property {boolean} [required] - flag indicating whether this field is required
  * @property {boolean} [literal] - flag indicating that this field always returns the option value
  * @property {boolean} [implicit] - flag indicating that this field exists implicitly in the post-transform value
  * @property {boolean} [dynamic] - true/undefined means treat functional values as dynamic lookups; false means treat functions as values
  * @property {string} [context] - triggers value to be copied to the context field with this name
  * @property {any} [default] - default value
  * @property {Array<any>} [values] - list of legal input values for this field
  * @property {boolean} [selector] - true if this schema acts as a selector
  * @property {boolean|string} [selection] - this schema activates if the selector matches the value, or matches this prop name if true
  */

/** @typedef {ISchemaOptionsCommon & {[key:string]: any}} ISchemaOptions */

/**
 * @typedef {object} ISchemaHandlers
 * @property {Array<ValueProcessorSpec>} [normalizers]
 * @property {Array<ValueProcessorSpec>} [conditions]
 * @property {Array<ValueProcessorSpec>} [transformers]
 * @property {Array<ValueProcessorSpec>} [serializers]
 * @property {ValueProcessorSpec} [unionDiscriminator]
 */



/**
 * @typedef {object} ISchemaMetadataAttributesCommon
 * @property {string} [_description] - help text description of the property; used by CommandLineSource
 * @property {string} [_valueName] - help text type name of the property value; used by CommandLineSource
 * @property {string} [_valueDescription] - help text description of the property value; used by CommandLineSource
 * @property {string} [_flagHint] - request a specific flag character; used by CommandLineSource
 * @property {boolean} [_advanced] - filter from basic help text; used by CommandLineSource
 * @property {boolean} [_hidden] - hide from help; used by CommandLineSource
 * @property {boolean} [_general] - mark this field for CommandLineSource to be used without a flag or option
 * @property {string} [_parserTypeHint] - set to base/primitive types to help source parsers interpret values
 * @property {boolean} [_omitFromSerialize] - set to true to omit this schema's value when serializing
 * @deprecated
 */

/**
 * @typedef {ISchemaOptionsCommon & ISchemaMetadataAttributesCommon & {[key:string]: any}} ISchemaAttributes
 * @deprecated
 */

/**
 * @typedef {{[key:string]: ISchema}} ISchemaProperties
 */

/**
 * @typedef {{[key:string]: ISchema}} ISchemaUnion
 */

/**
 * @typedef {object} SchemaData
 * @property {string} [base]
 * @property {{[key:string]: SchemaData}} [properties]
 * @property {{[key:string]: any}} [handlers]
 * @property {{[key:string]: string}} [metadata]
 * @property {{[key:string]: any}} [options]
 * @property {{[key:string]: SchemaData}} [unionSchemas]
 */

/**
 * @typedef {object} TraversalOptions
 * @property {boolean} [strict]
 * @property {boolean} [deep]
 * @property {TraversalContext} [context]
 * @property {Executor<TraversalState>} [enterExecutor]
 * @property {Executor<TraversalState>} [exitExecutor]
 * @property {SchemaLocation} [location]
 * @property {string} [path]
 * @property {string} [inputPath]
 * @property {any} [target]
 */

/** @typedef {TraversalOptions & {[key:string]: any}} SerializeOptions */

/** @typedef {TraversalOptions & {[key:string]: any}} ConfigureOptions */
/** @typedef {TraversalOptions & {[key:string]: any}} ValidateOptions */

/**
 * @typedef {object} ProcessOptions
 * @property {TraversalContext|TraversalOptions} [context]
 */



export {}; // Make this a module