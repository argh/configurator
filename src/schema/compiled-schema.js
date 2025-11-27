import { strict as assert } from 'assert';
import {
  ConstraintError,
  NormalizeError, ProcessorError,
  SchemaError,
  SerializeError,
  TransformError,
  ValidationError
} from '../errors.js';
import { deepAssign, isConstructor, isPlainObject } from '../utils.js';
import { toData } from './helpers/to-data.js';
import { expandWildcards } from './helpers/wildcard.js';
import { existingAssignment } from './helpers/assignment-helpers.js';
import { fpm } from './helpers/fpm.js';


/** @import { ISchemaOptions, ISchemaMetadata, SchemaData, SchemaValueProcessor, AsyncSchemaValueProcessor, AsyncSchemaValueVisitorFunction, AssignmentOptions, VisitOptions, SerializeOptions, ValidateOptions, PopulateOptions, CompiledValueProcessorDefinition } from './types.js' */

/** @typedef {import('./types.js').ISchemaMetadata} CompiledSchemaMetadata */

/** @typedef {ISchemaOptions} CompiledSchemaOptions
 */

/** @typedef {Object} CompiledSchemaHandlers
 * @property {Array<CompiledValueProcessorDefinition>} [normalizers]
 * @property {Array<CompiledValueProcessorDefinition>} [conditions]
 * @property {Array<CompiledValueProcessorDefinition>} [transformers]
 * @property {Array<CompiledValueProcessorDefinition>} [validators]
 * @property {Array<CompiledValueProcessorDefinition>} [serializers]
 * @property {Array<CompiledValueProcessorDefinition>} [discriminators]
 */

/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaProperties */
/** @typedef {Object.<string, import('./compiled-schema.js').CompiledSchema>} CompiledSchemaUnionSchemas */

/**
 * CompiledSchema - the resolved version of a schema usable for processing configuration assignments
 *
 * The SchemaResolver compiler takes an input Schema and constructs a CompiledSchema:
 * - The base schema hierarchy is resolved and flattened.
 * - Handlers have their input specifications converted into asynchronous processor functions.
 * - Unions may trigger property hoisting and discriminator synthesis.
 * - Core options are converted to standardized forms.
 * - Metadata is expanded by introspecting the resolved schema.
 * - Errors are thrown if the input Schema is invalid, inconsistent, or missing required data.
 *
 * @class
 * @typedef {import("./types.js").ISchema} ISchema
 * @implements ISchema
 */
export class CompiledSchema
{
  static __TOKEN = Symbol('CONSTRUCT_USING_RESOLVER')
  static __IGNORE = Symbol('IGNORE VALUE')
  static __STAGED = Symbol('STAGED');

  /**
   * CompiledSchema constructor - do not call directly (use SchemaResolver.compile())
   *
   * @param {Symbol} token - magic to reduce shenanigans
   * @param {CompiledSchema|undefined} [parent] - parent schema when added as a child
   * @param {string|undefined} [name] - property name within parent when added as a child
   */
  constructor(token, parent, name) {
    if (token !== CompiledSchema.__TOKEN) {
      throw new SchemaError('CompiledSchema must be created via compilation');
    }
    /** @type {string|undefined} */
    this._name = name;
    /** @type {CompiledSchema|undefined} */
    this._parent = parent;
    /** @type {CompiledSchemaProperties} */
    this._properties = {};
    /** @type {CompiledSchemaHandlers} */
    this._handlers = {};
    /** @type {CompiledSchemaOptions} */
    this._options = {};
    /** @type {CompiledSchemaMetadata} */
    this._metadata = {};
    /** @type {CompiledSchemaUnionSchemas} */
    this._unionSchemas = {};
  }

  /**
   * The name of the parent schema property that references this schema.  If there is no parent, returns undefined.
   *
   * @type {string|undefined}
   */
  get name() {
    return this._name;
  }

  /**
   * The parent schema that has this schema as a property. If there is no parent, returns undefined.
   *
   * @type {CompiledSchema|undefined}
   */
  get parent() {
    return this._parent; // overridden just for type narrowing
  }

  /**
   * The path to this schema within the entire schema hierarchy.
   *
   * - The root schema path is an empty string.
   * - Due to wildcard properties, the schema path may not match match the traversal path of a resolved configuration.
   * - Union schemas all return their path as if they were co-located with their union.
   * TODO - add union key?
   *
   * @type {string}
   */
  get path() {
    if (!this.name) {
      return '';  // this is an unattached schema, no path.
    }
    let parent = this.parent;
    return parent?.path ? `${parent.path}.${this.name}` : `${this.name}`;
  }

  /**
   * Options contains information that changes schema parsing and processing.
   *
   * @type {CompiledSchemaOptions}
   */
  get options() {
    return this._options;
  }

  /**
   * Metadata contains information for describing the schema behavior to users and hints for configuration sources.
   *
   * @type {CompiledSchemaMetadata}
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * Properties are named child schemas, defining a hierarchical schema structure.
   * - Property schemas are always unique instances, copied during compilation, and not shared.
   * - Each child schema has a "name" that will always equal the property name within this schema.
   * - Each child schema has a "parent" that will always reference this schema.
   *
   * @type {CompiledSchemaProperties}
   */
  get properties() {
    return this._properties;
  }

  /**
   * Handlers are associated with asynchronous value processors.
   *
   * The "friendly" handler definitions from the source Schema are each compiled into asynchronous functions
   * that run as a pipeline.
   *
   * All handlers have the same async signature, receiving:
   *   1. a value to be processed by the current schema
   *   2. a reference to the top-level aggregate being built or processed by the entire schema hierarchy
   *   3. a reference to the active schema that is processing the value
   *   4. the traversal path to the active schema (may not match schema path in event of wildcards!)
   *   5. any (unmanaged / developer defined) options passed to whatever invoked the handler processing
   *
   * The compiled handlers may vary in their return types and exception handling behavior.
   *
   * @type {CompiledSchemaHandlers}
   */
  get handlers() {
    return this._handlers;
  }

  /**
   * If this schema defines a union, return the schema member elements of the union.
   *
   * Unions use a discriminator handler to attempt to resolve to one of the unionSchema member elements
   * based on either the value being processed or the overall aggregated data.  The key of the
   * unionSchema in this collection is sometimes used as part of this process.
   *
   * Once the discriminator succeeds, the active schema switches to the resolved unionSchema.
   *
   * @type {CompiledSchemaUnionSchemas}
   */
  get unionSchemas() {
    return this._unionSchemas;
  }

  /**
   * Extract this schema as a raw data object.
   *
   * @returns {SchemaData|undefined}
   */
  toData() {
    return toData(this);
  }

  /**
   * Return true if this schema has any child schemas.
   *
   * @type {boolean}
   */
  get hasChildren() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let _ in this._properties) {
      return true;
    }
    return false;
  }

  /**
   * Return true if this schema defines an array.
   *
   * Arrays sometimes need special treatment; the built-in 'array' base schema sets this option.
   *
   * @type {boolean}
   */
  get isArray() {
    return this._options.type === 'array';
  }

  /**
   * Return true if this schema defines a function value.
   *
   * Functions passed to most operations are interpreted as dynamic values (called to retrieve actual value).
   * This setting overrides that behavior, and forces a passed function to be treated as a simple value.
   *
   * @returns {boolean}
   */
  get isFunction() {
    return this._options.type === 'function'
  }


  /**
   * Return true if this schema defines a union.
   * Unions adopt the behavior of one of their unionSchema member elements based on a discriminator handler function.
   *
   * @type {boolean}
   */
  get isUnion() {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let _ in this._unionSchemas) {
      return true;
    }
    return false;
  }

  /**
   * Return true if this schema is used to select union keys.
   * (This doesn't guarantee that there is a matching discriminator that uses it!)
   * @type {boolean}
   */
  get isUnionKey() {
    return !!this._options.unionKey;
  }

  /**
   * Return true if the schema acts as a selector.
   * Selectors control the activation or deactivation of peer selection schemas using a conditional handler
   * synthesized during compilation.
   *
   * @type {boolean}
   */
  get isSelector() {
    return !!this._options.selector;
  }

  /**
   * Return true if this schema is a selection conditionally activated by a peer selector.
   *
   * @type {boolean}
   */
  get isSelection() {
    return this._options.selection !== undefined;
  }

  /**
   * Get the selector value that triggers this selection.  The default value for a selection is its own property name.
   *
   * @type {string|undefined}
   */
  get selection() {
    if (typeof this._options.selection === 'string') {
      return this._options.selection;
    }
    else {
      return this._options.selection ? this.name : undefined;
    }
  }

  /**
   * Return the legal (normalized) values this schema accepts, if defined.
   * (This acts as an "upstream" check before calling any processing handlers.)
   *
   * @type {Array<NonNullable<any>>|undefined}
   */
  get values() {
    return this._options.values;
  }

  /**
   * Return true if this schema seems to be able to handle a given input value.
   *
   * @param {any} value
   * @returns {Promise<boolean>}
   */
  async accepts(value) {
    let normalizedValue;
    try {
      normalizedValue = await this.normalizeValue(value);
      if (normalizedValue === undefined) {
        return false;
      }
    }
    catch (_) {
      return false;
    }
    if (!Array.isArray(this.values)) {
      return true;
    }
    return this.values.includes(normalizedValue);
  }

  /**
   * Returns true if the value defined by this schema is required to exist in the output to be valid.
   *
   * Under the normal pathways, this is a shallow requirement:
   * - Each schema validates its own input; if the required flag is set, the input must not be undefined.
   * - If the input value is defined and the schema has children, all child property schemas will
   *   recursively validate the corresponding child value inside the input.
   * - If the input value is undefined, child property schemas are NOT validated.
   *
   * (There can be subtle interplay between the "required" flag and the "default" setting, as defaults
   * can be deep or shallow, depending on library configuration!)
   *
   * @type {boolean}
   */
  get required() {
    return this._options.required ?? false;
  }

  /**
   * Returns whether this schema enforces strict/lax validation:
   * - returns true if the schema should always use strict validation
   * - returns false if the schema should always use lax validation
   * - if undefined, it's up to validator
   *
   * This setting is useful for preventing validation errors when transforms return objects
   * that contain extra properties with no matching schema definition.
   *
   * @type {boolean|undefined}
   */
  get strict() {
    return this._options.strict;
  }

  /**
   * Returns the default value this schema provides if the input is undefined.
   *
   * At the schema level, this is interpreted as a "shallow" default, and will only populate if
   * processing the top-level value, or if the immediate parent is processing a defined
   * container value.
   *
   * However, for the purpose of configuration, "deep" defaults are usually desired, and the
   * SchemaDefaultsSource configuration source will synthesize assignments based on this default
   * value.  (You may change the Configurator source list to disable this behavior!)
   *
   * @type {any|undefined}
   */
  get default() {
    return this._options.default;
  }

  /**
   * Return true if the schema always returns an inherited value.
   *
   * Inherited properties never accept a direct assignment, and will always return the value
   * corresponding to the first matching property name found higher in the schema.
   *
   * @type {boolean}
   */
  get inherit() {
    return this._options.inherit ?? false;
  }

  /**
   * Returns true if this schema defines a value that can be assumed to always exist and be valid after transformation.
   *
   * The implicit setting implies that values passed to this schema should not be visited or validated.
   *
   * @type {boolean}
   */
  get implicit() {
    return this._options.implicit ?? false;
  }

  /**
   * Returns true if the container allows incremental assignment to children.
   * TODO - deprecate, flip logic, rename to "opaque".
   *
   * @returns {boolean}
   * @deprecated
   */
  get allowIncremental() {
    return this._options.allowIncremental ?? this.hasChildren;
  }

  /**
   * Returns true if the schema defines a value whose internals are hidden after transformation.
   *
   * @returns {boolean}
   */
  get opaque() {
    return this._options.allowIncremental === false;
  }

  async processAssignments(assignments, result, options) {

    // We can't handle magic paths in this approach:
    for (let path of assignments.keys()) {
      if (path.includes('*') || path.includes(':')) {
        assignments.delete(path);
      }
    }
    let input;
    for (const [path, value] of assignments) {
      input = deepAssign(input, path, value);
    }

    // Multi-phase
    // TODO - investigate: share status of union resolution across phases?  (fewer loops)
    //      - investigate: make defaults population part of normalization?
    const normalized = await this.normalize(input, options);
    const configuration = await this.transform(normalized, options);
//    await schema.populateDefaults(configuration);
    await this.validate(configuration, options);

    return configuration;
  }

  /**
   * Process a map of assignments into a validated output based on the current schema.
   *
   * Assignments are provided as a map of path-to-value pairs, where the path corresponds to the location in
   * the final output.
   *
   * Paths may be simple ("server.address") or include wildcards ("operations.*.debug") or be keyed to a
   * particular union member ("storage:redis.maxMemory") or even both ("commands.*:list.recursive").  The
   * path to this schema (the top level) is an empty string.
   *
   * It is possible for processAssignments to have no effect; either there were no assignments, or they were
   * filtered by conditionals.  In this case, the return value will reflect that nothing was done; typically
   * it will return undefined in this case, but it depends on the result parameter you provide:
   *
   * Normally, you will want to leave the result parameter undefined, so that the schema will build
   * the result for you based on this schema.
   *
   * However, if you pass an (appropriately typed) existing value in, the schema will attempt to use it to build
   * the final validated result.  For a schema with child schemas that supports incremental assignment, this means
   * that you would need to pass in a simple object or class instance or array.  It is assumed that this
   * "result" you pass in is pre-transformed; existing values in it are ignored.  This existing object will then
   * be incrementally populated by any successful assignments.
   *
   * (If this top-level schema schema defines a primitive type, or any schema without child properties, any
   * successful top-level assignment will return a new result value.  If the assignment has no effect, the original
   * result is returned.  Given the main purpose of this library is configuration, it would be silly to define a
   * value-type schema as the top level, but it's supported and tested for algorithmic consistency!)
   *
   * @param {Map<string,NonNullable<any>>} assignments - path-to-value pairs
   * @param {any} [result] - optional current value to use as the starting point for the result
   * @param {AssignmentOptions} [options] - optional assignment options
   * @returns {Promise<any>} - returns validated result
   */
  async oldprocessAssignments(assignments, result, options) {

    const doPopulateDefaults = (options?.populateDefaults !== false);
    const doValidate = (options?.validate !== false);

    // TODO - consider keeping wildcard defaults separate, and only expand relevant
    //        assignments when we actually use the wildcard schema!

    let wildcards = expandWildcards(assignments);

    for (let [path, value] of Array.from(wildcards)) {
      if (existingAssignment(assignments, path)) {
        continue;
      }
      assignments.set(path, value);
    }

    // ensure no actual wildcard path segments leak through
    for (let path of assignments.keys()) {
      if (path.includes('*')) {
        assignments.delete(path);
      }
    }

    const strict = options?.strict ?? true;
    const progress = new AssignmentProgress(this, assignments, strict);

    let done = false;

    progress.final = false;

    // Main assignment loop
    //
    // Process assignments until nothing changes, then attempt a final pass.
    // If anything is still unresolved during a final pass, it's an error.
    //
    // If a "final" pass triggers a change (e.g. unstaging staged data)
    // we clear the final flag and resume looping.

    while (!done) {
      let beforeCounter = progress.counter;

      for (let [path, value] of progress.remainingAssignments) {
        if (progress.isCompleted(path)) {
          continue;
        }
        try {
          let previous = result;
          result = await this._processAssignment(progress, result, path, value, '', result, path);

          if (result === CompiledSchema.__IGNORE) {
            progress.setCompleted(path);
            result = previous;
          }

          // Only enforce reference preservation for schemas with children (containers)
          // Value types (primitives) can be replaced since they're immutable
          if (this.hasChildren && previous !== undefined && previous !== null && result !== previous) {
            throw new SchemaError('Original input container replaced');
          }
        }
        catch (error) {
          if (error instanceof SchemaError && error?.message.includes(path)) {
            throw error;
          }
          const message = fpm('Assignment error', path);
          throw new SchemaError(message, {cause: error});
        }
      }

      let afterCounter = progress.counter;

      if (afterCounter === beforeCounter) {
        if (progress.final) {
          done = true;
        }
        else {
          progress.final = true;  // do one final cleanup pass
        }
      }
    }

    if (strict && progress.remainingAssignmentCount > 0) {
      throw new ValidationError(
        `Failed to assign ${progress.remainingAssignmentCount > 1 ? 'properties' : 'property'}: ${Array.from(
          progress.assignments.keys()).join(', ')}`);
    }

    const populated = doPopulateDefaults? await this.populateDefaults(result, options?.populateOptions) : result;
    return doValidate? await this.validate(populated, options?.validateOptions) : populated;
  }

  /**
   * Process a single deep assignment and store the results in the output, building on the overall assignment progress.
   *
   * Each assignment runs the handlers corresponding to their schema:
   *   1. normalize input
   *   2. resolve union if possible
   *   3. check if condition passes
   *   4. transform to output
   * Intermediate containers for deep paths are constructed (via normalizer) as needed.
   *
   * Once an assignment has been fully handled, progress.setCompleted is called with the assignment path.
   * The output from assignments for unresolved unions and opaque objects that don't allow incremental assignment are
   * "staged" until complete.  Uncompleted assignments (due to processors returning undefined) are left for the
   * processAssignments call to retry until the configuration stabilizes.
   *
   * @param {AssignmentProgress} progress - assignment state
   * @param {any} result                  - root object being built
   * @param {string} assignmentPath       - entire path to the assignment
   * @param {any} assignmentValue         - value to assign
   * @param {string} currentPath          - path to current schema in the assignment (starts at top === '')
   * @param {any} currentValue            - value corresponding to the current path, if any
   * @param {string} remainingPath        - the rest of the path below the current path
   * @returns {Promise<any|symbol>}
   * @private
   * @internal
   */
  async _processAssignment(progress, result, assignmentPath, assignmentValue, currentPath, currentValue, remainingPath) {

    /** @type {CompiledSchema} */
    let currentSchema = this;
    let staged = false;

    let dot = remainingPath.indexOf('.');

    const segment = (dot === -1) ? remainingPath : remainingPath.slice(0, dot);
    const [propertyName] = segment.split(/[.:]/, 1)
    const nextRemainingPath = (dot === -1) ? '' : remainingPath.slice(dot + 1);
    let unionKey;
    [currentPath, unionKey] = currentPath.split(':');

    const isAssignmentSchema = (propertyName === '');

    const originalCurrentValue = currentValue;
    if (currentValue === undefined || currentValue === null) {
      currentValue = progress.getStagedData(currentPath);
      if (currentValue !== undefined) {
        staged = true;
      }
    }
    if (isAssignmentSchema && assignmentValue === CompiledSchema.__STAGED) {
      assignmentValue = currentValue;
    }

    if (assignmentValue === undefined) {
      progress.setCompleted(assignmentPath);
      return staged ? originalCurrentValue : currentValue;
    }

    if (currentSchema.isUnion) {
      let resolved = progress.getResolvedSchema(currentPath);

      if (!resolved) {
        const discriminateValue = isAssignmentSchema ? assignmentValue : currentValue;
        const unionSchema = await currentSchema.discriminateUnion(discriminateValue, result, currentPath,{strict: progress.final});

        if (unionSchema) {
          const key = currentSchema.findUnionKey(unionSchema);
          if (!key) {
            throw new SchemaError('Union discriminator resolved to unknown schema');
          }
          resolved = progress.setResolvedSchema(currentPath, key, unionSchema);
        }
      }

      if (resolved) {
        if (unionKey && unionKey !== resolved.key) {
          progress.setCompleted(assignmentPath);
          return CompiledSchema.__IGNORE;  // does not match, so we will ignore this assignment
        }
        currentSchema = resolved.schema;
      }
      else {
        // not resolved, so we can't handle any assignments specific to a particular union key
        if (unionKey) {
          return originalCurrentValue;
        }
      }
    }
    const conditionValue = isAssignmentSchema ? assignmentValue : currentValue;

    if (!await currentSchema.checkCondition(conditionValue, result, currentSchema, currentPath)) {
      if (progress.final) {
        progress.setCompleted(assignmentPath);
      }
      return progress.final ? CompiledSchema.__IGNORE : undefined;
    }

    let propertyValue = undefined;
    let propertySchema = undefined;
    let propertyCurrentValue = undefined;

    if (!isAssignmentSchema) {
      assert(propertyName);

      // !isAssignmentSchema, but we're referencing propertyName, so being safe here...
      propertySchema = currentSchema.getPropertySchema(propertyName);

      if (!propertySchema) {
        if (currentSchema.isUnion) {

          if (progress.final) {
            throw new ValidationError(`Failed to process "${propertyName}" (unable to uniquely resolve "${currentPath}")`);
          }

          // we're still unresolved, so we'll just skip this assignment for now
          return originalCurrentValue;
        }
        if (progress.final && progress.strict) {
          throw new ValidationError(fpm('Unknown', currentPath, propertyName));
        }
        return staged? originalCurrentValue : currentValue;
      }

      if (propertySchema.implicit) {
        return CompiledSchema.__IGNORE;
      }

      const propertyPath = currentPath ? `${currentPath}.${segment}` : segment;
      propertyCurrentValue = currentValue?.[propertyName];
      propertyValue = await propertySchema?._processAssignment(progress, result, assignmentPath, assignmentValue, propertyPath, propertyCurrentValue, nextRemainingPath);

      if (propertyValue === CompiledSchema.__IGNORE) {
        // propagate the ignore state
        return CompiledSchema.__IGNORE;
      }

      if (propertyValue === undefined && !currentValue) {
        return originalCurrentValue;
      }
    }

    // If we are here, we need to have something instantiated for the current path
    // (either because this schema is the target, or because we have a child property to assign)

    let returnValue = currentValue;

    if (isAssignmentSchema && typeof assignmentValue === 'function' && !isConstructor(assignmentValue) && !currentSchema.isFunction) {
      // Unless the schema is explicitly typed as expecting function values, functions are interpreted as dynamically
      // resolved values with the same signature as a AsyncSchemaValueProcessor, invoked to retrieve the actual value.
      assignmentValue = await assignmentValue(currentValue, result, currentSchema, currentPath);

      if (assignmentValue === undefined) {
        return originalCurrentValue;
      }
    }

    if (isAssignmentSchema || returnValue === undefined || returnValue === null) {
      // By contract, container schema normalizers should construct an appropriate container type when passed "true"
      returnValue = await currentSchema.normalize(isAssignmentSchema? assignmentValue : true, result, currentPath);

      if (returnValue === undefined || returnValue === null) {
        // unusual case...
        progress.setCompleted(assignmentPath);
        return isAssignmentSchema? CompiledSchema.__IGNORE : undefined;  // todo - think about this
      }

      if (isAssignmentSchema && currentSchema.hasChildren && currentSchema.allowIncremental) {
        if (typeof returnValue === 'object' && Object.keys(returnValue).length > 0) {
          // When we're on the final part of the path but still pointing at a container,
          // we attempt to convert the (presumably parsed) value to individual child assignments.
          const assignments = currentSchema.toAssignments(returnValue, currentPath);
          progress.addAssignments(assignments);

          // The individual assignments we just created will drive container creation
          // on a subsequent pass through the assignment loop, so we're done with this path now.
          progress.setCompleted(assignmentPath);
          return originalCurrentValue;
        }
      }

      // See if we need to treat this as a container (even if it isn't, and we got here due to a bad assignment)
      const isContainer = !isAssignmentSchema
                          || currentSchema.hasChildren
                          || currentSchema.isArray
                          || currentValue && typeof currentValue === 'object';

      let orphanedPropertyValue = false;

      if ((currentSchema.allowIncremental || !isContainer) && !currentSchema.isUnion) {
        const transformedValue = await currentSchema.transform(returnValue, result, currentPath);

        if (propertyValue !== undefined && (!transformedValue || typeof transformedValue !== 'object')) {
          orphanedPropertyValue = true;  // we have a processed property that needs to be staged
        }
        else {
          returnValue = transformedValue;
        }
      }

      if (returnValue !== undefined && returnValue !== null
          && (orphanedPropertyValue || currentSchema.isUnion || (isContainer && !currentSchema.allowIncremental))) {
        // stage this data and add a magic assignment so we remember to try to resolve it
        progress.saveStagedData(currentPath, returnValue);
        progress.addAssignment(currentPath, CompiledSchema.__STAGED);
        staged = true;
      }
    }

    if (!isAssignmentSchema && propertyValue !== undefined && (propertyValue !== propertyCurrentValue)) {
      if (!returnValue || typeof returnValue !== 'object') {
        const schemaName = currentSchema.path || 'root'
        throw new SchemaError(`Current ${typeof returnValue} value at ${schemaName} cannot accept assignment to "${propertyName}"`)
      }
      if (/^\d+$/.test(propertyName)) {
        returnValue[Number(propertyName)] = propertyValue;
      }
      else {
        returnValue[propertyName] = propertyValue;
      }
    }

    if (staged) {
      if (!currentSchema.isUnion && (currentSchema.allowIncremental || progress.containerAssignmentsComplete(currentPath))) {
        // unstage!  todo - check if it's not a container (allowIncremental is false for value schemas!)
        returnValue = await currentSchema.transform(returnValue, result, currentPath);
        progress.clearStagedData(currentPath);
        staged = false;
      }
    }

    if (returnValue !== undefined) {
      if (isAssignmentSchema) {
        progress.setCompleted(assignmentPath);
      }
      return staged? originalCurrentValue : returnValue;
    }
    else {
      return undefined;
    }
  }

  /**
   * Return output that corresponds to the input after being populated with defaults found in the schema.
   *
   * The normal behavior of this call is to mutate the input data, and to only "shallowly" populate defaults.
   * You can override this behavior by passing in advanced visit() options, notably:
   * - visitUndefined (false) - if true, populate defaults everywhere in the entire schema hierarchy
   * - visitUndefinedShallow (true) - implies visitUndefined, but with a depth limit (self and immediate children)
   * - visitDefaults (true) - do not run validation if an input matches the default value
   *
   * @param {any} input - the input data
   * @param {VisitOptions} [options] - options to override how the data is visited
   * @returns {Promise<any>}
   */
  async populateDefaults(input, options) {
    return await this.visit(input, async (current, input, schema, path) => {
      if (schema !== undefined && current === undefined) {
        if (schema.default !== undefined) {
          current = await schema.normalizeValue(schema.default, input, path);
          if (current !== undefined) {
            current = await schema.transformValue(current, input, path);
          }
        }
      }
      return current;
    }, {visitUndefinedShallow: true, update: true, ...options});
  }


  /**
   * Check if the provided value passes the schema conditional check.
   *
   * Failed conditions will be repeatedly re-checked during assignment processing until the final pass.
   * Errors encountered while checking conditions are caught and simply result in a failed condition.
   *
   * @param {any} value
   * @param {any} configuration
   * @param {CompiledSchema} schema
   * @param {string} path
   * @param {Object} [options]
   * @returns {Promise<boolean>}
   */
  async checkCondition(value, configuration, schema, path, options) {
    const conditions = Array.isArray(this._handlers.conditions)? this._handlers.conditions : [];

    // no conditions = pass!
    if (conditions.length === 0) {
      return true;
    }

    let checked = value;
    for (const condition of conditions) {
      try {
        checked = await condition.processor(checked, configuration, this, path, options);
      }
      catch (error) {
        return false;  // exception = failed condition check
      }
    }
    return Boolean(checked);
  }


  /**
   * Ensure the input is of an expected shape that can be handled by this schema.
   *
   * Runs all normalizer value processors in a pipeline until one returns undefined or throws an error.
   * As most external configuration will originate in the form of strings or JSON
   * structures, the main task of a normalizer is to "canonicalize" these inputs:
   * - The normalized output should be accepted by the transformer handler.
   * - Normalizers should pass through valid transformed values unchanged.
   * - By contract, when passed "true", a container schema should construct an "empty"
   *   container (e.g. {} or []).  (Even a schema that defines transformation to a
   *   complex class should have a normalized empty container format to use for construction).
   *
   * The normalize process will throw an exception if the input is incompatible.
   *
   * Unlike other handlers, normalizers should generally not depend on the overall
   * configuration state, as they are sometimes invoked in isolation (even during compilation!)
   * and thus shouldn't depend on the "undefined means retry later" behavior of other handlers.
   *
   * @param {any} value
   * @param {any} [configuration]
   * @param {string} [path]
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async normalizeValue(value, configuration = {}, path = this.path, options) {

    if (typeof value === 'function' && !isConstructor(value)) {
      if (this.options.type !== 'function') {
        try {
          value = await value(true, configuration, this, path, options);
        }
        catch (error) {
          throw new NormalizeError(fpm('Exception calling value function', path), {cause: error});
        }
      }
    }


    if (value === undefined) {
      return undefined;
    }

    const normalizers = Array.isArray(this._handlers.normalizers)? this._handlers.normalizers : [];

    let normalized = value;
    for (const normalizer of normalizers) {
      try {
        normalized = await normalizer.processor(normalized, configuration, this, path, options);
      }
      catch (error) {
        throw new NormalizeError(fpm('Could not normalize', path), {cause: error});
      }
    }
    return normalized;
  }





  /**
   * @param {any} value
   * @param {Object} [normalizeOptions]
   * @returns {Promise<any>}
   */
  async normalize(value, normalizeOptions) {

    const strict = normalizeOptions?.strict ?? true;

    return await this.newVisit(value, async (current, result, schema, path, progress) => {

      if (progress.final) {
        if (!schema && strict && !this.getPropertyPaths().has(path)) {
          throw new NormalizeError(fpm('Unexpected property', path));
        }
        if (schema?.isUnion) {
          throw new NormalizeError(fpm('Unable to resolve union', path));
        }
        if (current === undefined && schema?.default !== undefined) {
          current = schema.default;
        }
      }
      if (schema === undefined) {
        return undefined;
      }
      return await schema.normalizeValue(current, result, path, normalizeOptions);

    }, {visitUnexpected: true, visitUndefined: true, visitOpaque: true, visitUndefinedShallow: true, mode: VisitMode.COPY});
  }



  /**
   * Transform an input value for the final configuration based on this schema and provided context.
   *
   * Runs all transformer value processors in a pipeline until one returns undefined or throws an error.
   * - The input to the pipeline is be assumed to be normalized.
   * - An error may be thrown if the input cannot be transformed.
   * - If a transformer depends upon the overall configuration, it may return undefined to signal
   *   that the transform should be retried when the configuration is updated.
   *
   * A schema's transform is allowed to enforce validation internally, or it can delegate this to
   * the validation handler.  In any case, the output from the transform is not guaranteed to be valid.
   *
   * @param {any} value - input value to transform
   * @param {any} configuration - global configuration in case the transformer depends on it
   * @param {string} path - the path to this value in the global configuration (caller will set)
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async transformValue(value, configuration = {}, path = this.path, options) {

    if (value === undefined) {
      return undefined;
    }

    // todo - can we move value checking to a constraint processor?
    if (value !== null && this.values && this.values.length > 0) {
      // if we have children, we can't compare the value yet, we'll have to wait for validation.
      if (!this.hasChildren && !this.values.includes(value)) {
        const isContainerInit = (value === true && (this.options.type === 'object' || this.options.type === 'array'))
        const strict = this.strict ?? options?.strict ?? true;
        if (!isContainerInit && strict) {
          throw new TransformError(fpm(`Invalid value: "${value}", expected one of {${this.values.join('|')}}`, path));
        }
      }
    }

    const transformers = Array.isArray(this._handlers.transformers)? this._handlers.transformers : [];

    let transformed = value;
    for (const transformer of transformers) {
      try {
        transformed = await transformer.processor(transformed, configuration, this, path, options);
      }
      catch (error) {
        throw new TransformError(fpm('Unable to transform', path), {cause: error})
      }
    }
    return transformed;
  }

  /**
   * @param {any} value - input value to transform
   * @param {any} [configuration] - global configuration in case the transformer depends on it
   * @param {string} [path] - the path to this value in the global configuration (caller will set)
   * @param {Object} [options] - any tweaks to the transformer behavior
   * @returns {Promise<any>} - transformed value
   */
  async transform(value, configuration, path = this.path, options) {

    const strict = options?.strict ?? true;

    return await this.newVisit(value, async (current, result, schema, path, progress) => {

      if (progress.final) {
        if (!schema && !this.getPropertyPaths().has(path) && strict) {
          throw new TransformError(fpm('Unexpected property', path));
        }
        if (schema?.isUnion) {
          throw new TransformError(fpm('Unable to resolve union', path));
        }
        if (current === undefined) {
          if (progress.hasPending(path)) {
            // fixme?
            throw new TransformError(fpm('Inconsistent container value', path));
          }
          return undefined;
        }
      }

      if (!schema) {
        return undefined;
      }

      if (schema.hasChildren && current === true) {
        // request to create a container!
        const normalized = await schema.normalizeValue(true, result, schema, path, options);
        if (!schema.allowIncremental) {
          progress.savePending(path, normalized);
          return normalized;
        }
        current = normalized;  // for incremental, we will pre-transform, so pass on what we just normalized
      }

      return await schema.transformValue(current, result, path, options);
    }, {visitUnexpected: true, visitOpaque: true, mode: VisitMode.COPY, visitUndefined: true, visitUndefinedShallow: true, enforceRequired: false});
  }

  /**
   * Return a validated output if and only if the input fully matches the schema definition.
   *
   * Runs all validator processors in a pipeline until one returns undefined or throws an error:
   * - The validation input is assumed to already have been transformed.
   * - If the input data is invalid, the validate call will throw an error.
   *
   * The normal behavior of validate is to simply return the input data if it passes the checks,
   * but by passing advanced options, you can change how validation functions:
   * - enforceUnionResolution (true) if false, unresolved unions are not an error
   * - enforceRequired (true) if false, missing requirements are not an error
   * - enforceValues (true) if false, the output will not be normalized to check against allowed values
   * - disallowUnexpected (true) if false, extra properties in the data are not an error
   * You can also pass any visit() options, notably:
   * - visitUndefined (false) - if true, deep validate the data against the entire schema hierarchy
   * - visitUndefinedShallow (true) - implies visitUndefined, but with a depth limit (self and immediate children)
   * - visitDefaults (true) - do not run validation if an input matches the default value
   * Only one of the following may be set:
   * - update (false) - if true, return the input (possibly mutated by the validation processors)
   * - copy (false) - if true, return a (potentially different) copy of the input (as output from validation processors)
   * - extract (true) - if true, just return the original input
   *
   * @param {any} input - input value to validate
   * @param {ValidateOptions} [options] - any tweaks to the validator behavior
   * @returns {Promise<any>} - validated value
   */
  async validate(input, options = {}) {

    const strict = options.strict ?? true;

    const enforceUnionResolution = options.enforceUnionResolution ?? true;
    const disallowUnexpected = options.disallowUnexpected ?? strict;
    const enforceRequired = options.enforceRequired ?? true;
    const enforceValues = options.enforceValues ?? true;

    try {
      const validated = await this.newVisit(input, async (current, input, schema, path, progress) => {
        if (!schema) {
          const parentSchema = this.findParent(path);

          let strictParent = parentSchema?.options.strict ?? strict;

          if (strictParent && disallowUnexpected) {
            throw new ValidationError(fpm('Unexpected value', path));
          }
          return EMPTY_VALUE;
        }

        if (schema.isUnion && enforceUnionResolution) {
          throw new ValidationError(fpm('Unable to discriminate union', path))
        }

        if (current === undefined) {
          if (enforceRequired) {
            if (schema.required && enforceRequired) {
              throw new ValidationError(fpm('Missing required value', path));
            }
          }
          return EMPTY_VALUE;
        }

        if (enforceValues && Array.isArray(schema.values)) {
          // Invariant: if values are defined, they should contain the normalized form of the transformed value.
          let normalized;
          try {
            normalized = await schema.normalizeValue(current, input, path);
          }
          catch (error) {
            throw new ValidationError(fpm('Unable to check value', path))
          }

          if (!schema.values?.includes(normalized)) {
            throw new ValidationError(fpm(`Invalid normalized value "${normalized}", expected one of {${schema.values.join('|')}}`, path));
          }
        }

        const validators = Array.isArray(schema._handlers.validators)? schema._handlers.validators : [];

        let v = current;

        for (const validator of validators) {
          try {
            v = await validator.processor(v, input, schema, path, options);
          }
          catch (error) {
            throw new ValidationError(fpm('Validation error', path), {cause:error})
          }
        }
        return v;
      }, {visitOpaque: false, resolveUnions: true, enforceRequired: true, visitUndefinedShallow: true, visitUnexpected: !disallowUnexpected, visitDefaults: true, ...options})
      return validated === EMPTY_VALUE ? undefined : validated;
    }
    catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      else {
        throw new ValidationError('Validation failed', {cause:error});
      }
    }
  }

  /**
   * Serialize the config data as if you were going to use the result for a config file.
   *
   * Runs all serialization processors in a pipeline.  By default, if any processor returns undefined or throws an error,
   * serialization of that value returns undefined and will be omitted from the output.  If you set the "strict"
   * option, errors are re-thrown.
   *
   * Serializers attempt to convert resolved values back to an input-friendly value, first via the "serialize"
   * schema option, or alternatively by trusting that each value is either already compatible, or implements toJSON().
   *
   * @param {any} config
   * @param {SerializeOptions} [options]
   * @returns {Promise<NonNullable<any>>}
   */
  async serialize(config, options = {}) {
    const strict = options.strict ?? false;

    const serialized = await this.visit(config, async (value, configuration, schema, path, options) => {
      try {
        if (schema === undefined || schema.metadata.omitFromSerialize) {
          return EMPTY_VALUE;
        }
        const serializers = Array.isArray(schema._handlers.serializers)? schema._handlers.serializers : [];

        let s = value;
        for (const serializer of serializers) {
          try {
            s = await serializer.processor(s, configuration, schema, path, options);
          }
          catch (error) {
            if (strict) {
              throw error;
            }
            return EMPTY_VALUE;
          }
        }
        return s;
      }
      catch (error) {
        throw new SerializeError(`${fpm('Error serializing', path)}`);
      }
    }, {...options, extract: true});

    return serialized === EMPTY_VALUE? undefined : serialized;
  }

  /**
   * Use the registered discriminator to return a matching union schema, or undefined if the union cannot be resolved.
   * Discriminator functions must return either one of the unionSchema members, a unionSchema key, or undefined.
   *
   * @param {any} value
   * @param {any} configuration
   * @param {string} path
   * @param {object} [options]
   * @returns {Promise<CompiledSchema|undefined>}
   */
  async discriminateUnion(value, configuration, path, options) {
    if (value === undefined) {
// FIXME ?      return undefined;
    }

    const strict = options?.strict ?? false;

    if (!this.isUnion || this._handlers.discriminators === undefined) {
      return undefined;
    }

    const discriminators = Array.isArray(this._handlers.discriminators)? this._handlers.discriminators : [];

    // we'll run multiple discriminators if necessary, but it's a bizarre use case...

    let discriminatorResult = value;
    for (const discriminator of discriminators) {
      try {
        discriminatorResult = await discriminator.processor(discriminatorResult, configuration, this, path, options);
      }
      catch (error) {
        if (strict) {
          throw error;
        }
        return undefined;
      }
    }
    if (!discriminatorResult) {
      if (strict) {
        throw new SchemaError(fpm('Unable to resolve union', path));
      }
      return undefined;
    }
    if (typeof discriminatorResult === 'string') {
      // String lookups (e.g., from property extraction) - return undefined if no match
      return this.unionSchemas[discriminatorResult];
    }
    if (discriminatorResult instanceof CompiledSchema && this.findUnionKey(discriminatorResult)) {
      return discriminatorResult;
    }
    // Schema returned but not valid - this is a developer error
    throw new SchemaError(fpm('Union discriminator returned unexpected value', path))
  }

  /**
   * Given a reference to a union schema member, return the matching key, or undefined if it cannot be found.
   *
   * @param {CompiledSchema} unionSchema
   * @returns {string|undefined}
   */
  findUnionKey(unionSchema) {
    return Object.keys(this.unionSchemas).find(key => this.unionSchemas[key] === unionSchema)
  }

  /**
   * Find the schema at a given path (supports wildcards and colon-delimited union keys in path components).
   * The root schema may be found at '', the empty string.  Array members are referenced with dotted integer indexes.
   *
   * @param {string} path
   * @returns {undefined|CompiledSchema}
   */
  find(path) {
    if (!path || path === '' || path === '.') {
      return this;
    }
    const pathComponents = path.split('.');

    /** @type {CompiledSchema|undefined} */
    let s = this;

    for (let pathComponent of pathComponents) {
      let parts = pathComponent.split(':');
      if (parts.length > 1) {
        pathComponent = parts[0];
      }
      s = s?.properties[pathComponent] ?? s?.properties['*'];

      if (s?.isUnion && parts.length > 1) {
        s = s.unionSchemas[parts[1]];
      }

      if (!s) {
        return undefined;
      }
    }
    return s;
  }

  /**
   * Find the parent schema for a given path, even if parts of the path do not exist in the schema hierarchy.
   *
   * Given unknown path components, the result might be several levels higher than the provided path would imply!
   *
   * @param {string} path
   * @returns {CompiledSchema|undefined}
   */
  findParent(path) {
    if (!path || path === '' || path === '.') {
      return undefined;
    }
    let dot = path.lastIndexOf('.');

    if (dot === -1) {
      return this;
    }
    path = path.substring(0, dot);
    const parentSchema = this.find(path);
    if (parentSchema) {
      return parentSchema;
    }
    return this.findParent(path);
  }


  /**
   * toAssignments - attempt to convert input data to a map of assignments.
   *
   * @param {any} object - input
   * @param {string} prefix - prefix to add to any path generated
   * @returns {Map<string, any>} - output map of path-to-value associations
   */
  toAssignments(object, prefix = '') {
    if (typeof object !== 'object') {
      return new Map([['', object]])
    }

    const assignments = new Map();

    function walk(schema, current, path) {
      const isContainer = Array.isArray(current) || isPlainObject(current);

      const allowIncremental = schema?.allowIncremental ?? true;
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (isContainer && hasChildren) {//} && allowIncremental) {
        const entries = Array.isArray(current)? current.entries() : Object.entries(current);

        for (const [key, value] of entries) {
          const propertySchema = schema?.getPropertySchema(key);
          walk(propertySchema, value, path ? `${path}.${key}` : `${key}`)
        }
      }
      else {
        assignments.set(path, current);
      }
    }
    walk(this, object, prefix);
    return assignments;
  }

  // todo - did I decide not to go this way?  remove or use!
  async newToAssignments(object, prefix = '') {
    if (typeof object !== 'object') {
      return new Map([['', object]]);
    }
    const assignments = new Map();

    await this.visit(object, async (current, configuration, schema, path) => {

      const isContainer = Array.isArray(current) || isPlainObject(current);
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (!isContainer && !hasChildren) {
        // We visit intermediate nodes
        assignments.set(path, current);
      }

    }, {update: false, visitUnexpected: true, visitUndefined: false, resolveUnions: false});

    return assignments;
  }

  /**
   * Invoke a provided visitor function on every schema node; if visitor returns false (explicitly), abort early.
   *
   * @param {(schema:CompiledSchema, path:string) => any} visitor - visitor function
   * @param {{addUnionKeys?:boolean, onlySerializable?:boolean}} [options]
   * @returns {boolean} - returns true if visitors all returned true, false if any exited early
   */
  visitSchema(visitor, options) {
    const addUnionKeys = options?.addUnionKeys ?? false;
    const onlySerializable = options?.onlySerializable ?? false;
    /**
     * @param {CompiledSchema} schema
     * @param {string} path
     * @returns {any|boolean}
     */
    function walk(schema, path) {
      if (schema.metadata.omitFromSerialize && onlySerializable) {
        return false;
      }
      if (schema.hasChildren) {
        for (const propName in schema.properties) {
          let childPath = path ? `${path}.${propName}` : `${propName}`;
          if (walk(schema.properties[propName], childPath) === false) {
            return false;
          }
        }
      }
      if (schema.isUnion) {
        for (const unionSchemaKey in schema.unionSchemas) {
          const p = addUnionKeys ? `${path}:${unionSchemaKey}` : path;
          if (walk(schema.unionSchemas[unionSchemaKey], p) === false) {
            return false;
          }
        }
      }
      return visitor(schema, path);
    }
    return walk(this, '') ?? true;
  }

  // We will use this as a signal
  // todo: consolidate with __IGNORE?
  static get EMPTY_VALUE() { return EMPTY_VALUE }

  /**
   * Asynchronously call a provided visitor function on everything in an input object based on the schema definition.
   *
   * If a visitor returns a value, it is propagated; otherwise the original value is used.
   * The EMPTY_VALUE symbol is used to signal that the result should be pruned from the output.
   *
   * TODO: consolidate update/copy/extract into a visitResult option
   *       document options
   *
   * @param {any} input - input object
   * @param {AsyncSchemaValueVisitorFunction} visitor - async visitor
   * @param {VisitOptions} [options] - options to pass to visitor
   * @returns {Promise<any>} - returns result of visitor call on outermost schema
   */
  async visit(input, visitor, options) {
    const resolveUnions = options?.resolveUnions ?? true;
    const visitDefaults = options?.visitDefaults ?? true;
    const visitContainers = options?.visitContainers ?? true;
    const visitUnexpected = options?.visitUnexpected ?? false;
    const visitUndefinedShallow = options?.visitUndefinedShallow ?? false;
    const visitUndefined = visitUndefinedShallow || (options?.visitUndefined ?? false);
    const update = options?.update ?? false;
    const copy = options?.copy ?? false;
    const extract = options?.extract ?? false;

    if (update && (copy || extract)) {
      throw new SchemaError('Visit option conflict: specify only copy/extract or update, not both!');
    }

    /**
     * @param {CompiledSchema|undefined} schema
     * @param {any|undefined} current
     * @param {string} path
     * @returns {Promise<any|symbol>}
     */
    async function walk(schema, current, path) {
      if (schema !== undefined) {
        const condition = await schema.checkCondition(current, input, schema, path);
        if (!condition) {
          return EMPTY_VALUE;
        }

        if (!visitDefaults && schema.default !== undefined && current === schema.default) {
          return EMPTY_VALUE;
        }

        if (schema.options.implicit) {
          return current;
        }

        if (schema.isUnion && resolveUnions && current !== undefined) {
          /** @type {CompiledSchema|undefined} */
          const unionSchema = await schema.discriminateUnion(current, input, path, {strict: resolveUnions})

          if (unionSchema) {
            schema = unionSchema;
          }
        }
      }

      let ret = (copy || extract) ? undefined : current;
      if (!schema?.hasChildren) {
        ret = current;
      }

      // Traverse children?
      if (schema !== undefined && schema.hasChildren && ((ret !== undefined) || !visitUndefinedShallow)) {
        const updateProperty = async (key, val) => {
          if ((copy || update || extract) && val !== EMPTY_VALUE && val !== undefined) {
            if (ret === undefined) {
              if (extract) {
                ret = schema.isArray? [] : {};
              }
              else {
                ret = await schema.normalizeValue(true, input, path);

                if (ret && schema.allowIncremental) {
                  ret = await schema.transform(ret, input, path);
                }
              }
            }
            if (ret) {
              ret[key] = val;
            }
          }
          else if (update && (val === EMPTY_VALUE || val === undefined)) {
            if (ret) {
              delete ret[key];
            }
          }
        }

        /** {type {Set<string>}} */
        const visited = new Set();

        // First, walk the actual object and validate that all members are known
        // (We only walk "regular" objects; we trust the validator of transformed values.)
        // todo - skip if marked opaque even if plain object?
        if (Array.isArray(current) || isPlainObject(current)) {
          const keys = Object.keys(current).map(key => /^\d+$/.test(key) ? Number(key) : key);
          for (let key of keys) {
            const propertyName = `${key}`;
            const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
            const propertySchema = schema.getPropertySchema(propertyName);
            const propertyValue = current[key];

            visited.add(propertyPath);
            if (propertySchema === undefined && schema.options.strict && !visitUnexpected) {
              throw new ValidationError(fpm('Unexpected', path, propertyName));
            }

            if (propertyValue === undefined && !visitUndefined) {
              continue;
            }

            const r = await walk(propertySchema, propertyValue, propertyPath) ?? propertyValue;

            await updateProperty(key, r);
          }
        }
        if (visitUndefined && schema.allowIncremental && (current === undefined || Array.isArray(current) || isPlainObject(current))) {
          // Next, walk the schema and visit everything that was undefined
          for (const propertyName in schema.properties) {
            const propertySchema = schema.properties[propertyName];
            const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;
            if (visited.has(propertyPath) || propertyName === '*' || propertySchema.options.implicit) {
              continue;
            }
            const key = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;

            // By definition, we've already walked anything that has a defined value
            const r = await walk(propertySchema, undefined, propertyPath);

            await updateProperty(key, r);
          }
          if ((copy || update) && ret !== undefined && !schema.allowIncremental) {
            ret = await schema.transform(ret, input, path);
          }
        }
        if (!visitContainers) {
          return current;
        }
      }
      if (ret === undefined && !visitUndefined) {
        return undefined;
      }
      return await visitor(ret, input, schema, path) ?? ret;
    }
    const ret = await walk(this, input, '');

    return (ret === EMPTY_VALUE) ? undefined : ret;
  }


  /**
   *
   *
   * @param {any} input - input object
   * @param {AsyncSchemaValueVisitorFunction} visitor - async visitor
   * @param {VisitOptions} [visitOptions] - options to use while visiting (also passed to visitor)
   * @returns {Promise<any>} - returns result of visitor call on outermost schema
   */
  async newVisit(input, visitor, visitOptions) {
    const resolveUnions = visitOptions?.resolveUnions ?? true;
    const visitDefaults = visitOptions?.visitDefaults ?? true;
    const visitUnexpected = visitOptions?.visitUnexpected ?? false;
    const visitUndefinedShallow = visitOptions?.visitUndefinedShallow ?? false;
    const visitUndefined = visitUndefinedShallow || (visitOptions?.visitUndefined ?? false);
    const visitOpaque = visitOptions?.visitOpaque ?? false;
    const enforceRequired = visitOptions?.enforceRequired ?? false;

    const mode = visitOptions?.mode ?? VisitMode.VISIT;

    let done = false;

    const progress = new VisitProgress();

    let output = (mode === VisitMode.VISIT || mode === VisitMode.UPDATE)? input : undefined;

    /**
     * @param {CompiledSchema|undefined} schema
     * @param {any} inputCurrent
     * @param {string} path
     * @returns {Promise<any|symbol>}
     */
    const walk = async (schema, inputCurrent, path) => {

      if (schema === undefined) {
        if (!this.isValidPath(path) && !visitUnexpected) {
          throw new SchemaError(fpm('Unknown property', path));
        }
        progress.saveUncompleted(path);
      }
      if (schema !== undefined) {
        if (schema.implicit) {
          progress.saveCompleted(path, EMPTY_VALUE);
          return EMPTY_VALUE;
        }
        if (progress.isCompleted(path)) {
          if (!schema.hasChildren || progress.containerAssignmentsComplete(path)) {
            return progress.getCompleted(path);
          }
        }
        else {
          progress.saveUncompleted(path);
        }

        if (!progress.hasPositiveCondition(path)) {
          const condition = await schema.checkCondition(inputCurrent, output, schema, path);
          if (condition === true) {
            progress.savePositiveCondition(path);
          }
          else {
            if (progress.final) {
              progress.saveCompleted(path, undefined);
            }
            return EMPTY_VALUE;
          }
        }

        if (schema.opaque && !visitOpaque) {
          progress.saveCompleted(path, inputCurrent);
          return inputCurrent;
        }

        if (schema.options.implicit) {
          progress.saveCompleted(path, inputCurrent);
          return inputCurrent;  // todo - think about this; move to transform?
        }

        if (progress.hasUnpackedContainer(path)) {
          inputCurrent = progress.getUnpackedContainer(path);
        }

        if (schema.isUnion && resolveUnions) {
          if (!progress.hasResolvedUnion(path)) {
            const unionSchema = await schema.discriminateUnion(inputCurrent, output, path, {strict: resolveUnions});

            if (unionSchema) {
              progress.saveResolvedUnion(path, unionSchema);
            }
          }
          if (progress.hasResolvedUnion(path)) {
            return await walk(progress.getResolvedUnion(path), inputCurrent, path);
          }
        }
      }

      // ret is the return value from this pass through walk...
      let current = (mode === VisitMode.VISIT || !(schema?.hasChildren))? inputCurrent : undefined;

      // Traverse children?
      if (schema !== undefined && schema.hasChildren && ((inputCurrent !== undefined) || !visitUndefinedShallow)) {

        // helper function to delay container pre-visit until first child has a value

        const updateProperty = async (propertyName) => {
          const propertySchema = schema.getPropertySchema(propertyName);

          const propertyPath = path ? `${path}.${propertyName}` : `${propertyName}`;

          const key = /^\d+$/.test(propertyName) ? Number(propertyName) : propertyName;
          const inputPropertyValue = inputCurrent?.[key];
          const processedPropertyValue = await walk(propertySchema, inputPropertyValue, propertyPath);

          if (processedPropertyValue === undefined || processedPropertyValue === EMPTY_VALUE) {
            return EMPTY_VALUE;
          }

          if (mode !== VisitMode.COPY) {
            return;
          }

          let container = progress.getCompleted(path) ?? progress.getPending(path);

          if (!container) {
            container = await visitor(true, output, schema, path, progress);

            if (container === undefined || !((typeof container === 'object') || Array.isArray(container))) {
              throw new SchemaError(fpm('Unable to construct container', path, propertyName));
            }
            if (!progress.hasPending(path)) {
              progress.saveCompleted(path, container);
            }
          }

          if (processedPropertyValue !== container[key]) {
            container[key] = processedPropertyValue;
          }
          current = container;
        }

        const visited = new Set();
        // Iterate all visible properties that exist in the input object
        if (Array.isArray(inputCurrent) || isPlainObject(inputCurrent)) {
          for (const propertyName of Object.keys(inputCurrent)) {
            visited.add(propertyName);
            await updateProperty(propertyName);
          }
        }
        // Iterate all properties defined in the schema to catch undefined properties
        if (visitUndefined) {
          for (const propertyName in schema.properties) {
            if (visited.has(propertyName) || propertyName === '*') {
              continue;
            }
            await updateProperty(propertyName);
          }
        }
      }  // end child traversal


      if (schema === undefined && !visitUnexpected) {
        return undefined;
      }

      if (current === undefined && !visitUndefined) {
        return undefined;
      }

      if (progress.isCompleted(path)) {
        return progress.getCompleted(path);
      }

      // Call the visitor iff...
      // - we're on the final pass (this is how errors will get reported)
      // - we have a schema and are processing a simple value
      // - we have a pending container, and all child assignments are complete

      if (progress.final
          || (schema && !schema.hasChildren)
          || (!schema && visitUnexpected)
          || progress.hasPending(path) && progress.containerAssignmentsComplete(path)) {

        const result = await visitor(current, output, schema, path, progress);

        if (result === undefined && current !== undefined && progress.final && schema?.required) {
          throw new SchemaError(fpm(`Failed to process required value "${current}"`, path));
        }
        else if (result === EMPTY_VALUE) {
          progress.saveCompleted(path, EMPTY_VALUE);
        }
        else if (result !== EMPTY_VALUE && result !== undefined) {

          if (schema?.hasChildren && !(Array.isArray(inputCurrent) || typeof inputCurrent === 'object' || inputCurrent === true)) {
            // If we unpacked an encoded container, treat it as if it were the input
            progress.saveUnpackedContainer(path, result);
            return await walk(schema, result, path);
          }

          progress.saveCompleted(path, result);
        }
        return mode === VisitMode.VISIT ? inputCurrent : result;
      }
      return undefined;
    }


    // We need to do multiple passes to resolve cross references between conditions, unions, and opaque containers

    while (!done) {
      let start = progress.counter;
      const ret = await walk(this, input, '');
      output = (ret === EMPTY_VALUE) ? undefined : ret;

      if (start === progress.counter) {
        if (progress.final) {
          done = true;
        }
        else {
          progress.final = true;
        }
      }
      else {
        progress.final = false;
      }
    }
    return output;
  }



  /**
   * Compute all possible schema paths (including union schema properties, optionally adding colon-delimited union keys)
   *
   * @param {{addUnionKeys: boolean?}} [options]
   * @returns {Set<string>}
   */
  getPropertyPaths(options) {
    const addUnionKeys = options?.addUnionKeys ?? false;
//    const flattenUnions = (options?.flattenUnions) ?? false;
//    const verboseUnions = (options?.verboseUnions) ?? false;
//    const wildcards = (options?.wildcards) ?? false;

    const propertyPaths = new Set();

    this.visitSchema((schema, path) => {
      if (path) {
        propertyPaths.add(path);
      }
    }, {addUnionKeys})
    return propertyPaths;
  }

  /**
   * Return a named property schema (possibly via wildcard)
   *
   * @param {string} propertyName
   * @returns {CompiledSchema}
   */
  getPropertySchema(propertyName) {
    if (propertyName === undefined || propertyName === '') {
      throw new SchemaError('Unable to retrieve an unnamed property');
    }
    return this.properties[propertyName] ?? this.properties['*'];
  }

  /**
   * Return all child schemas that have a particular option tag
   *
   * @param {string} tag
   * @returns {CompiledSchema[]}
   * @deprecated
   */
  getTagged(tag) {
    const schemas = [];
    for (let propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        schemas.push(schema);
      }
    }
    return schemas;
  }

  /**
   * Get the first child schema that has a particular option tag
   *
   * @param {string} tag
   * @returns {CompiledSchema|undefined}
   * @deprecated
   */
  getFirstTagged(tag) {
    for (let propName in this.properties) {
      const schema = this.getPropertySchema(propName);
      if (schema.options[tag]) {
        return schema;
      }
    }
    return undefined;
  }

  /**
   * Return true if the path is legal within the schema (including all union schemas)
   *
   * TODO - add support for explicit union keys?
   *
   * @param {string} path
   * @returns {boolean}
   */
  isValidPath(path) {
    if (path === '') {
      return true;  // means the current schema!
    }
    const parts = path.split('.');

    function check(schema, index = 0) {
      if (index >= parts.length) {
        return schema !== undefined;
      }
      let propertyName = parts[index];

      if (schema.hasChildren && schema.getPropertySchema(propertyName)) {
        return check(schema.getPropertySchema(propertyName), index + 1);
      }
      else if (schema.isUnion) {
        for (let unionSchema of schema.unionSchemas) {
          if (check(unionSchema, index)) {
            return true;
          }
        }
      }
      return false;
    }
    return check(this);
  }

  /**
   * Write-protect this schema at the end of compilation.
   *
   * @internal
   */
  freeze() {
    for (let childSchema of Object.values(this._properties)) {
      childSchema.freeze();
    }
    Object.freeze(this._properties);
    Object.freeze(this._options);
    Object.freeze(this._metadata);
    for (let unionSchema of Object.values(this._unionSchemas)) {
      unionSchema.freeze();
    }
    Object.freeze(this._unionSchemas);
    Object.freeze(this);
  }
}


/**
 * Helper class for tracking assignment completion state
 * @internal
 */
class AssignmentStatus {
  constructor(path) {
    this.path = path;
    this.completed = false;
  }
}

/**
 * Helper class for tracking progress of all assignments
 * @internal
 */
class AssignmentProgress {
  constructor(rootSchema, assignments, strict = true) {
    this.schema = rootSchema;
    this.completed = new Map();
    /** @type {Map<string,{key:string,schema:CompiledSchema}>} */
    this.resolvedSchemas = new Map();
    this.conditions = new Map();
    this.required = new Map();
    this.staged = new Map();
    this.strict = strict;
    this.processing = {};
    this.final = false;

    this.pathStatus = new Map();

    this.assignments = new Map([...assignments]);

    this.counter = 0;
  }

  addAssignment(path, value) {
    if (!this.assignments.has(path)) {
      this.counter++;
    }
    this.assignments.set(path, value);

    this.setCompleted(path, false); // reprocess!  (todo - verify this is what we want)
  }

  addAssignments(assignments) {
    for (let [path, value] of assignments) {
      this.addAssignment(path, value);
    }
  }

  get remainingAssignmentCount() {
    return this.assignments.size;
  }

  get remainingAssignments() {

    // Sort the remaining assignments for processing.
    // We don't build this in advance because we may add new assignments on any given pass.
    // The primary goal is to ensure that any low-priority bulk assignments to containers (which are
    // generally split into individual assignments, but there isn't a requirement to do so) don't overwrite
    // individual child assignments to that container.  E.g. if foo.bar is an array, and you assign
    // foo.bar.0="z" and also foo.bar=["a", "b", "c"], we want foo.bar=["z", "b", "c"], not ["a", "b", "c"].
    // Since we're already here, we also prioritize selectors and discriminators, in order to reduce the
    // number of passes we need to take to get everything done.

    return Array.from(this.assignments.entries())
                             .sort((a, b) => {
                               const pathA = a[0];
                               const pathB = b[0];

                               const dotsA = (pathA.match(/\./g) || []).length;
                               const dotsB = (pathB.match(/\./g) || []).length;

                               if (dotsA !== dotsB) return dotsA - dotsB;

                               const schemaA = this.schema.find(pathA);
                               const schemaB = this.schema.find(pathB);

                               if (schemaA && !schemaB) return -1;
                               if (!schemaA && schemaB) return 1;

                               if (schemaA && schemaB) {
                                 const priorityA = schemaA.isSelector || !!schemaA.options.staged?.length;
                                 const priorityB = schemaB.isSelector || !!schemaB.options.staged?.length;

                                 if (priorityA && !priorityB) return -1;
                                 if (!priorityA && priorityB) return 1;
                               }
                               if (pathA.indexOf(':') === -1 && pathB.indexOf(':') >= 0) {
                                 return -1;
                               }
                               if (pathA.indexOf(':') >= 0 && pathB.indexOf(':') === -1) {
                                 return 1;
                               }

                               return pathA.localeCompare(pathB, undefined, { numeric: true });
                             })

  }

  containerAssignmentsComplete(path) {
    for (const assignmentPath of this.assignments.keys()) {
      if (path === '' && assignmentPath !== '') {
        return false;  // if we're checking the root, then any keys at all mean we're not done
      }
      if (assignmentPath.startsWith(`${path}.`) || assignmentPath.startsWith(`${path}:`)) {
        return false;
      }
    }
    return true;
  }


  findUnresolvedUnion(path) {
    while (true) {
      let schema = this.schema.find(path);

      if (!schema) {
        return null;
      }
      if (schema.isUnion && !this.resolvedSchemas.get(path)) {
        return path;
      }
      let dot = path.lastIndexOf('.');

      if (dot === -1) {
        return null;
      }
      path = path.slice(0, dot);
    }
  }

  getStatus(path) {
    let status = this.pathStatus.get(path);
    if (!status) {
      status = new AssignmentStatus(path);
      this.pathStatus.set(path, status);
    }
    return status;
  }

  setCompleted(path, completed = true) {
    this.getStatus(path).completed = completed;
    if (completed) {
      this.counter++;
      this.assignments.delete(path);
    }
  }
  isCompleted(path) {
    return this.getStatus(path).completed ?? false;
  }

  /**
   * @param {string} path
   * @returns {{key: string, schema: CompiledSchema}|undefined}
   */
  getResolvedSchema(path) {
    return this.resolvedSchemas.get(path);
  }

  /**
   * @param {string} path
   * @param {string} key
   * @param {CompiledSchema} schema
   *
   * @returns {{key:string,schema:CompiledSchema}}
   */
  setResolvedSchema(path, key, schema) {
    if (this.getResolvedSchema(path)?.schema !== schema) {
      this.counter++;
      this.resolvedSchemas.set(path, {key, schema});
      this.final = false;
    }
    return {key, schema};
  }

  setCondition(path, value) {
    this.conditions.set(path, value);
  }

  getCondition(path) {
    return this.conditions.get(path) ?? false;
  }

  setRequired(path, value = true) {
    this.required.set(path, value);
  }
  isRequired(path) {
    return this.required.get(path) ?? false;
  }

  getStagedData(path) {
    return this.staged.get(path);
  }

  saveStagedData(path, value) {
    let currentValue = this.staged.get(path);

    if (value !== currentValue) {
      this.counter++;
      if (value === undefined) {
        this.staged.delete(path)
        if (this.assignments.get(path) === CompiledSchema.__STAGED) {
          this.assignments.delete(path);
        }
      }
      else {
        if (typeof value !== 'object') {
          throw new SchemaError('Can only stage objects')
        }

        this.staged.set(path, value);
      }
    }
    return value;
  }
  clearStagedData(path) {
    let currentValue = this.getStagedData(path);
    this.saveStagedData(path, undefined);
    return currentValue;
  }
}

const EMPTY_VALUE = Symbol('EMPTY')

class VisitProgress {
  constructor() {
    this.pending = new Map();
    this.completed = new Map();
    this.resolved = new Map();
    this.conditions = new Set();
    this.uncompleted = new Set();
    this.unpacked = new Map();

    this.final = false;

    this.counter = 0;
  }

  savePositiveCondition(path) {
    if (!this.conditions.has(path)) {
      this.conditions.add(path);
      this.counter++;
      this.final = false;
    }
  }

  hasPositiveCondition(path) {
    return this.conditions.has(path);
  }

  saveResolvedUnion(path, unionSchema) {
    if (this.resolved.get(path) !== unionSchema) {
      this.resolved.set(path, unionSchema);
      this.counter++;
      this.final = false;
    }
  }

  getResolvedUnion(path) {
    return this.resolved.get(path);
  }

  hasResolvedUnion(path) {
    return this.resolved.get(path) !== undefined;
  }

  saveUnpackedContainer(path, value) {
    if (this.unpacked.get(path) !== value) {
      this.unpacked.set(path, value);
      this.counter++;
      this.final = false;
    }
  }

  getUnpackedContainer(path) {
    return this.unpacked.get(path);
  }

  hasUnpackedContainer(path) {
    return this.unpacked.has(path);
  }

  savePending(path, value) {
    if (!this.pending.get(path) !== value) {
      this.pending.set(path, value);
      this.counter++;
      this.final = false;
    }
  }

  getPending(path) {
    return this.pending.get(path);
  }
  hasPending(path) {
    return this.pending.get(path) !== undefined;
  }

  saveCompleted(path, value) {
    if (this.pending.has(path)) {
      this.pending.delete(path);
    }
    if (this.uncompleted.has(path)) {
      this.uncompleted.delete(path);
    }
    if (this.completed.get(path) !== value) {
      this.completed.set(path, value);
      this.counter++;
      this.final = false;
    }
  }
  getCompleted(path) {
    return this.completed.get(path);
  }
  isCompleted(path) {
    return this.completed.get(path) !== undefined;
  }

  saveUncompleted(path) {
    this.uncompleted.add(path);
  }

  containerAssignmentsComplete(path) {
    if (path === '' && this.uncompleted.size > 0) {
      return false;
    }
    for (let p of this.uncompleted) {
      if (p.startsWith(`${path}.`)) {
        return false;
      }
    }
    return true;
  }


}

/**
 * Policies for fine-grained control of composite schema internals
 * @readonly
 * @enum {Symbol}
 */
export const VisitMode = Object.freeze({
  COPY: Symbol('COPY'),
  UPDATE: Symbol('UPDATE'),
  VISIT: Symbol('VISIT')
});

