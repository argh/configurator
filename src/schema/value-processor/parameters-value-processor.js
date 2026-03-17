import { ConstantExecutor, Executor, toExecutor } from '../executor/executor.js';
import { ObjectExecutor } from '../executor/object-executor.js';
import { SchemaError } from "../schema-errors.js";
import { ValueProcessor } from './value-processor.js';
import { SchemaLocation } from "../schema-location.js";
import { ArrayExecutor } from '../executor/array-executor.js';
import { isEmpty, isPlainObject, map } from '../../utils.js';
import { ComposedValueProcessor } from './composed-value-processor.js';

/** @typedef {[key:string, executor:Executor]} ObjectExecutorEntry */

/**
 * @augments {ValueProcessor}
 */
export class ParametersValueProcessor extends ValueProcessor {

  /** @type {Executor} */
  #executor;

  /** @type {object[]} */
  #parameters;

  /** @type {any} */
  #constantValue;

  /**
   * @param {object[]} [parameters]
   * @param {ValueProcessor[]|{[parameter:string]:ValueProcessor}} [argsProcessors]
   */
  constructor(parameters = [], argsProcessors = {}) {

    super();

    const processorObject = {};

    if (Array.isArray(argsProcessors)) {
      if (argsProcessors.length > parameters.length) {
        throw new SchemaError(`Too many arguments`);
      }
      for (let p = 0; p < parameters.length; ++p) {
        if (p < argsProcessors.length) {
          processorObject[parameters[p].parameter] = argsProcessors[p];
        }
      }
    }
    else {
      if (Object.keys(argsProcessors).length > parameters.length) {
        throw new SchemaError('Too many arguments');
      }
      for (let p = 0; p < parameters.length; ++p) {
        const arg = argsProcessors[parameters[p].parameter];
        if (arg) {
          processorObject[parameters[p].parameter] = arg;
        }
      }
      for (const parameter of Object.keys(argsProcessors)) {
        if (processorObject[parameter] === undefined) {
          throw new SchemaError(`Unknown parameter ${parameter}`);
        }
      }
    }

    for (let p = 0; p < parameters.length; ++p) {
      if (processorObject[parameters[p].parameter] === undefined && parameters[p].default !== undefined) {
        processorObject[parameters[p].parameter] = new ComposedValueProcessor(new ConstantExecutor(parameters[p].default), parameters[p].default);
      }
      if (processorObject[parameters[p].parameter] === undefined && parameters[p].required) {
        throw new SchemaError(`Missing required argument for parameter ${parameters[p].parameter}`);
      }
    }
    this.#executor = new ObjectExecutor(processorObject);
    this.#parameters = parameters;
    if (this.#executor.isConstant) {
       const args = this.#executor.execute(true);
       this.#constantValue = this.#check(args);

       let d='';
       for (const [p,v] of Object.entries(args)) {
         if (d.length) {
           d += ','
         }
         d += `${p}=${v}`
       }
       this.description=`[${d}]`
    }
    this.spec = map(processorObject, param => param.spec);

  }

  #check(args) {

    for (const p of this.#parameters) {
      if (args[p.parameter] === undefined) {
        if (p.default !== undefined) {
          args[p.parameter] = p.default;
        }
        else if (p.required) {
          throw new SchemaError(`Undefined value provided for required parameter ${p.parameter}`)
        }
      }
    }
    return args;
  }


  /**
   * @param {object} args
   * @param {any} target
   * @param {SchemaLocation} location
   * @param {object} options
   * @returns {object|Promise<object>}
   */
  execute(args, target, location, options) {
    if (this.#constantValue !== undefined) {
      return this.#constantValue;
    }
    const result = this.#executor.execute(args, target, location, options);

    if (result instanceof Promise) {
      return result.then(resolved => this.#check(resolved))
    }
    return this.#check(result);
  }

  get isConstant() {
    return this.#constantValue !== undefined;
  }
}
