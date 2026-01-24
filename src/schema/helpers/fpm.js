import { SchemaLocation } from "../schema-location.js";

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