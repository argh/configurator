import { SchemaLocation } from "../schema-location.js";
import { stringify } from './stringify.js';

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
export function fpm(message, where, property, prep = 'at') {

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

export function fpvm(message, value, where, property, prep) {
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