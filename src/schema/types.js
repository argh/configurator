/**
 * @typedef {Object} ISchema
 * @property {string} [base] - Base schema name for extension
 * @property {string} [name] - Schema name
 * @property {ISchema} [parent] - Parent schema in hierarchy
 * @property {string} path - Path to this schema in the schema hierarchy
 * @property {ISchemaProperties} properties - Schema properties
 * @property {ISchemaOptions} options - Schema options
 * @property {ISchemaMetadata} metadata - Schema metadata
 * @property {ISchemaHandlers} handlers - Schema handlers
 * @property {ISchemaUnion} unionSchemas - Union schema definitions
 * @property {(schema:ISchema) => SchemaData|undefined} toData - Serialize schema to plain object
 */

/** @import { CompiledSchema, VisitMode } from "./compiled-schema.js" */

/**
 * @template TReturn
 * @template TSchema
 * @callback SchemaValueProcessorBase
 * @param {any} value
 * @param {Object|Array<any>} configuration
 * @param {TSchema} schema
 * @param {String} path
 * @param {Object} [options]
 * @returns {TReturn}
 */

/**
 * @template TReturn
 * @typedef {SchemaValueProcessorBase<TReturn,CompiledSchema>} SchemaValueProcessor
 */

/**
 * @template TReturn
 * @typedef {SchemaValueProcessorBase<Promise<TReturn>,CompiledSchema>} AsyncSchemaValueProcessor
 */

/**
 * @typedef {SchemaValueProcessorBase<Promise<any>,CompiledSchema|undefined>} AsyncSchemaValueVisitorFunction
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


///** @typedef {ISchemaMetadataCommon & {[key:string]: any}} ISchemaMetadata1 */

/** @typedef {"any"|"string"|"number"|"boolean"|"bigint"|"symbol"|"object"|"array"|"function"|"null"} SchemaFundamentalType */

 /**
  * @typedef {Object} ISchemaOptionsCommon
  * @property {SchemaFundamentalType} [type] - should only be set on the core types supported by the schema
  * @property {SchemaValueProcessor<any>} [normalizer] - ensure value is of correct shape.
  * @property {SchemaValueProcessor<any>|AsyncSchemaValueProcessor<any>} [transformer] - value resolver - map input value to output value.
  * @property {SchemaValueProcessor<any>|AsyncSchemaValueProcessor<any>|string|RegExp|object} [validator] - validator specification.
  * @property {SchemaValueProcessor<any>|AsyncSchemaValueProcessor<any>} [serializer] - convert a validated input to serialized form
  * @property {SchemaValueProcessor<boolean>|AsyncSchemaValueProcessor<any>|boolean} [condition] - conditional check whether to process this schema
  * @property {SchemaValueProcessor<any>|AsyncSchemaValueProcessor<any>|string} [discriminator] - function or property name that returns a union discriminator
  * @property {function(string,ISchema):void} [compileHook] - a function called during schema compilation
  * @property {boolean} [allowEmpty] - whether an array type or string type can be empty
  * @property {boolean} [strict] - whether to do strict typechecking (defaults to true; must be explicitly false to be "lax")
  * @property {boolean} [inherit] - disallow direct assignment; value will be inherited from a parent
  * @property {boolean} [required] - flag indicating whether this field is required
  * @property {boolean} [literal] - flag indicating that this field always returns the option value
  * @property {boolean} [implicit] - flag indicating that this field exists implicitly in the post-transform value
  * @property {string} [context] - triggers value to be copied to the context field with this name
  * @property {any} [default] - default value
  * @property {Array<any>} [values] - list of legal input values for this field
  * @property {boolean} [selector] - true if this schema acts as a selector
  * @property {boolean|string} [selection] - this schema activates if the selector matches the value, or matches this prop name if true
  */

/** @typedef {ISchemaOptionsCommon & {[key:string]: any}} ISchemaOptions */

/**
 * @typedef {Object} ISchemaHandlers
 * @property {Array<ProcessorSpec>} [normalizers]
 * @property {Array<ProcessorSpec>} [conditions]
 * @property {Array<ProcessorSpec>} [transformers]
 * @property {Array<ProcessorSpec>} [serializers]
 * @property {ProcessorSpec} [unionDiscriminator]
 */



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
 * @deprecated
 */

/** @typedef {ISchemaOptionsCommon & ISchemaMetadataAttributesCommon & {[key:string]: any}} ISchemaAttributes
 * @deprecated
 */

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
 * @property {Object.<string,any>} [handlers]
 * @property {Object.<string,any>} [metadata]
 * @property {Object.<string,any>} [options]
 * @property {Object.<any,SchemaData>} [unionSchemas]
 */

/** @typedef {Object} VisitOptions
 * @property {VisitMode} [mode]
 * @property {boolean} [resolveUnions] - true = attempt to resolve unions (otherwise just visit union itself)
 * @property {boolean} [visitUndefined] - true = visit entire schema hierarchy, even if the input object has undefined values
 * @property {boolean} [visitUndefinedShallow] - true = visit hierarchy, but don't continue into child properties if parent is undefined
 * @property {boolean} [visitUnexpected] - true = visit properties that were not expected
 * @property {boolean} [visitDefaults] -     true means visit even if value matches schema defaults
 * @property {boolean} [visitContainers] - true = call visitor on containers (post-order), not just leaf values
 * @property {boolean} [visitContainersPreOrder] - true = extra call to visitor on containers before iterating children
 */

/** @typedef {Object} ValidateOptions
 * @extends VisitOptions
 * @property {boolean} [enforceUnionResolution]
 * @property {boolean} [enforceRequired]
 * @property {boolean} [enforceValues]
 * @property {boolean} [deepRequired]
 * @property {boolean} [disallowUnexpected]
 * @property {boolean} [strict]
 */

/** @typedef {Object} PopulateOptions
 * @extends VisitOptions
 * @property {boolean} [strict]
 */

/** @typedef {Object} SerializeOptions
 * @extends VisitOptions
 * @property {boolean} [strict]
 */

/** @typedef {Object} AssignmentOptions
 * @property {boolean} [strict]
 * @property {boolean} [populateDefaults]
 * @property {PopulateOptions} [populateOptions]
 * @property {boolean} [validate]
 * @property {ValidateOptions} [validateOptions]
 */


/** @typedef {Object} ConfigureOptions
 * @property {boolean} [strict]
 * @property {boolean} [deep]
 * @property {AssignmentOptions} [assignmentOptions]
 */

/** @typedef {ValueProcessorDefinition|Object|string|RegExp|SchemaValueProcessor<any>} ProcessorSpec */


/** @typedef {Object} CompiledSpec
 * @property {ProcessorSpec} spec
 * @property {AsyncSchemaValueProcessor<any>} processor
 * @property {string} [description]
 */


/** @callback ProcessorSpecCompiler
 * @param {ProcessorSpec} spec
 * @returns {CompiledSpec}
 */

/** @callback ValueProcessorBuilder
 * @param {ProcessorSpec|Array<ProcessorSpec>|undefined} args
 * @param {ProcessorSpecCompiler} specCompiler
 * @returns CompiledValueProcessorDefinition
 */

/**
 * @typedef {Object} ValueProcessorDefinition
 * @property {string} [keyword]
 * @property {SchemaValueProcessor<any>} [processor]
 * @property {string} [description]
 * @property {ValueProcessorBuilder} [builder]
 */

/**
 * @typedef {Object} CompiledValueProcessorDefinition
 * @property {ProcessorSpec} spec
 * @property {SchemaValueProcessor<any>} processor
 * @property {string} [description]
 */



export {}; // Make this a module