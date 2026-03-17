import { ValueProcessor } from './value-processor.js';
import { isEmpty, isPlainObject, map } from '../../utils.js';
import { SchemaLocation } from "../schema-location.js";
import { Executor } from '../executor/executor.js';
import { ComposedValueProcessor } from './composed-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';
import { ObjectExecutor } from '../executor/object-executor.js';
import { SchemaCompilationError, SchemaError } from '../schema-errors.js';
import { ParametersValueProcessor } from './parameters-value-processor.js';

/** @import {ValueProcessorFunction, ValueProcessorDefinition, ValueProcessorArgs} from './value-processor.js' */

/**
 * @augments {ValueProcessor}
 */
export class DefinedValueProcessor extends ValueProcessor
{
  /** @type {ValueProcessor|undefined} */
  #argsProcessor;

  /** @type {ValueProcessorFunction} */
  #process;

  /**
   * @param {ValueProcessorDefinition} definition
   * @param {ValueProcessor[]|{[parameter:string]:ValueProcessor}} [args]
   */
  constructor(definition, args) {
    super();

    if (!definition.keyword) {
      throw new SchemaError('Processor definition requires a keyword');
    }
    if (!definition.process) {
      throw new SchemaError('Processor definition requires a process function');
    }
    if (definition.build) {
      // This should have been handled upstream!
      throw new SchemaCompilationError('Internal compiler error: factory definitions unsupported by DefinedValueProcessor');
    }

    if (definition.parameters !== undefined) {
      this.#argsProcessor = new ParametersValueProcessor(definition.parameters, args);
      this.spec = {[`$${definition.keyword}`]: this.#argsProcessor.spec}
    }
    else if (args) {
      const argSpecs = map(args, arg => arg.spec);

      if (Array.isArray(args)) {
        this.#argsProcessor = new ComposedValueProcessor(new ArrayExecutor(args), argSpecs);
      }
      else if (typeof args === 'object') {
        this.#argsProcessor = new ComposedValueProcessor(new ObjectExecutor(args), argSpecs)
      }
      else {
        throw new SchemaCompilationError('Internal compiler error: unsupported keyword arguments type')
      }
      this.spec = {[`$${definition.keyword}`]: this.#argsProcessor.spec}
    }
    else {
      this.spec = `$${definition.keyword}`;
    }
    this.#process = definition.process;
    this.description = definition.description;

    if (this.description === undefined && definition.describe) {
      this.description = definition.describe(args);
    }
    this.description ??= `$${definition.keyword}`;
  }

  /**
   * @param {any} value
   * @param {any} target
   * @param {SchemaLocation} location
   * @param {object} options
   * @returns {any|null|undefined|Promise<any|null|undefined>}
   */
  execute(value, target, location, options) {
    if (this.#argsProcessor) {
      const args = this.#argsProcessor.execute(value, target, location, options);

      if (args instanceof Promise) {
        return args.then(argsResolved => this.#process(value, target, location, {...options, args: argsResolved}))
      }
      return this.#process(value, target, location, {...options, args});
    }
    return this.#process(value, target, location, options);
  }
}

/**
 * @param {string} keyword
 * @param {ValueProcessorArgs|undefined} args
 * @returns {any}
 */
function getSpec(keyword, args) {
  if (!args || isEmpty(args)) {
    return `$${keyword}`;
  }
  return {[`$${keyword}`]: map(args, arg => arg.spec)};
}