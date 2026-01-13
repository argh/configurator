/**
 * Format a path (possibly with property), typically for error messages.
 *
 * @param {string} message
 * @param {string} path
 * @param {string|number} [property]
 * @param {string} [prep]
 * @returns {string}
 * @internal
 */
export function fpm(message, path, property, prep = 'at') {

  let m = message;

  if (property) {
    m += ` property ${property}`
  }
  if (path) {
    m += ` ${prep} ${path}`;
  }

  return m;
}