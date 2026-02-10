import assert from "node:assert";
import { SchemaLocation } from "./schema/schema-location.js";
import { stringify } from './schema/helpers/stringify.js';


/**
 * Format a location/path (possibly with property), typically for error messages.
 *
 * @param {string} message
 * @param {string|SchemaLocation|undefined} where - path or location
 * @param {string|number} [property]
 * @param {string} [prep]
 * @returns {string}
 * @internal
 */
function fpm(message, where, property, prep = 'at') {

  if (where instanceof SchemaLocation) {
    where = `${where}`;
  }
  let m = message;

  if (property) {
    m += ` property ${property}`
  }
  if (where) {
    m += ` ${prep} ${where}`;
  }

  return m;
}

/**
 * @param {string} message
 * @param {any} value
 * @param {SchemaLocation|string|undefined} where
 * @param {string|number} [property]
 * @param {string} [prep]
 * @returns {string}
 * @internal
 */
function fpvm(message, value, where, property, prep) {
  /** @type {string|undefined} */
  let valueString;
  const vsd = typeof value === 'string'? '"' : '«';
  const ved = typeof value === 'string'? '"' : '»'
  try {
    if (typeof value === 'string') {

    }
    if (typeof value === 'object' && value !== null ) {
      value = stringify(value);
    }
    valueString = `${value}`;
    if (valueString.length > 20) {
      valueString = valueString.slice(0, 20) + '...';
    }
  }
  catch (error) {
    // ignore
  }
  if (valueString?.length) {
    message = `${message} value ${vsd}${valueString}${ved}`

  }
  return fpm(message, where, property,  prep);
}

export class ConfiguratorError extends Error {
  /**
   * @param {string} message
   * @param {object} [data]
   * @param {Error|any} [data.cause]
   * @param {SchemaLocation} [data.location]
   * @param {string} [data.path]
   * @param {any} [data.value]
   * @param {number} [data.code]
   * @param {Array<Error>} [data.errors]
   * @param {boolean} [preserveStack]
   */
  constructor(message, data, preserveStack = false) {
    // noinspection JSCheckFunctionSignatures

    /** @type {Error|undefined} */
    const cause = data?.cause
      ? data.cause instanceof Error
        ? data.cause
        : new ConfiguratorError(data.cause, undefined, false)
      : undefined;

    const path = data?.path ?? data?.location?.path;

    if (!path || message.indexOf(path) === -1) {
      if (data?.hasOwnProperty('value')) {
        message = fpvm(message, data?.value, path);
      }
      else {
        message = fpm(message, path);
      }
    }

    super(message, cause ? { cause } : undefined);

    if (data) {
      /** @type {any} */
      this.data = { ...data, cause };
    }
    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      // @ts-ignore
      this.__proto__ = actualProto;
    }

    if (!preserveStack) {
      // @ts-ignore
      //      delete this.stack;
    }

    if (data?.cause && !super.cause) {
      // should be set on super, but just in case...
      this.cause = data.cause;
    }
  }
  get name() {
    return this.constructor.name;
  }
  //  get stack() {
  //    return "";
  //  }

  set stack(str) {}

  //  get cause() {
  //    return super.cause ?? this.data?.cause;
  //  }

  toString() {
    if (this.message) {
      return `${this.name}: ${this.message}`;
    } else {
      // @ts-ignore
      if (this.cause?.message) {
        // @ts-ignore
        return `${this.name}: ${this.cause.message}`;
      } else {
        return this.name;
      }
    }
  }
}

export class SchemaError extends ConfiguratorError {}
export class ConstraintError extends SchemaError {}
export class ProcessorError extends SchemaError {}
export class ValidationError extends SchemaError {}
export class NormalizeError extends SchemaError {}
export class TransformError extends SchemaError {}
export class SerializeError extends SchemaError {}
export class UnionResolutionError extends SchemaError {}
export class ResolverError extends ConfiguratorError {}
export class SchemaCompilationError extends SchemaError {}

/**
 * @param {Error} error
 * @param {RegExp|string} match
 * @param {string} [fullErrorMessage]
 * @param {Error} [err]
 * @returns {boolean}
 */
export function assertErrorMessageInCauseChain(error, match, fullErrorMessage, err) {

  if (err === undefined) {
    err = new assert.AssertionError(
      {
        message: 'message not found in cause chain',
        stackStartFn: assertErrorMessageInCauseChain
      });
  }

  const errorMessage = (error?.message ?? '');

  fullErrorMessage = fullErrorMessage? `${fullErrorMessage} «${errorMessage}»` : `«${errorMessage}»`;

  if (match instanceof RegExp && match.test(errorMessage)) {
    return true;
  }
  else if (errorMessage.toLowerCase() === `${match}`.toLowerCase()) {
    return true;
  }
  else if (error.cause instanceof Error) {
    return assertErrorMessageInCauseChain(error.cause, match, fullErrorMessage, err );
  }
  else {
    err.message = `«${match}» not found in cause chain ${fullErrorMessage}`;
    throw err;
  }
}

