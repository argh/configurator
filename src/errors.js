import assert from "node:assert";
//import { SchemaLocation } from "./schema/schema-location.js";
import { stringify } from '@versionzero/schema/helpers';
import { isPlainObject } from './utils.js';


const DELIMITED = /^[^A-Za-z0-9_].+[^A-Za-z0-9_]$/;

/**
 * @param {any} value
 * @param {object} [options]
 * @returns {string}
 */
export function formatValue(value, options = {}) {
  const { delimiterOpen = '«', delimiterClose = '»', maxLength = 40 } = options;

  try {
    if (value === null) {
      return `${delimiterOpen}null${delimiterClose}`;
    }
    else if (value === undefined) {
      return `${delimiterOpen}undefined${delimiterClose}`;
    }
    let valueString;
    if (typeof value === 'function' && value.name) {
      valueString = `${delimiterOpen}${value.name}()${delimiterClose}`;
    }
    else if (typeof value === 'object' && !isPlainObject(value) && value.constructor?.name) {
      valueString = `${delimiterOpen}${value.constructor.name}${delimiterClose}`;
    }
    else {
      // get our stringified json  of the value
      valueString = stringify(value, {delimiterOpen, delimiterClose});
    }
    if (typeof value !== 'string'
        && ((valueString.startsWith('"') && valueString.endsWith('"'))
            || (valueString.startsWith("'") && valueString.endsWith("'")))) {
      // if what we got back has quotes but the original wasn't a string, remove them.
      valueString = valueString.slice(1, -1);
    }
    if (!DELIMITED.test(valueString)) {
      valueString = `${delimiterOpen}${valueString}${delimiterClose}`;
    }
    if (valueString.length > 40) {
      // everything should be delimited here.  grab the final char so we can reattach it.
      const finalChar = valueString.charAt(valueString.length - 1);
      valueString = valueString.slice(0, 40) + `...${finalChar}`;
    }
    return valueString;
  }
  catch (error) {
    return '�'
  }
}
/**
 * Format a location/path (possibly with property), typically for error messages.
 *
 * @param {string} message
 * @param {string|undefined} where - path
 * @param {string|number} [property]
 * @param {string} [prep]
 * @returns {string}
 * @internal
 */
function fpm(message, where, property, prep = 'at') {

  if (where === '') {
    where = '(root)'
  }
  else if (where){
    where = `"${where}"`
  }

  if (property) {
    where = where? `${where} property "${property}"` : `property "${property}"`;
  }

  let m = message;

  if (where) {
    m += ` ${prep} ${where}`;
  }

  return m;
}

/**
 * @param {string} message
 * @param {any} value
 * @param {string|undefined} where
 * @param {string|number} [property]
 * @param {string} [prep]
 * @returns {string}
 * @internal
 */
function fpvm(message, value, where, property, prep) {
  /** @type {string|undefined} */
  const valueString = formatValue(value);

  if (valueString?.length) {
    message = `${message} with value ${valueString}`;
  }
  return fpm(message, where, property,  prep);
}

export class ConfiguratorError extends Error {
  /**
   * @param {string} message
   * @param {object} [data]
   * @param {Error|any} [data.cause]
   * @param {string} [data.path]
   * @param {string|number} [data.property]
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

    const path = data?.path ?? data?.cause?.path;
    const property = data?.property;

    if (!path || message.indexOf(path) === -1) {
      if (data?.hasOwnProperty('value')) {
        message = fpvm(message, data?.value, path, property);
      }
      else {
        message = fpm(message, path, property);
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

