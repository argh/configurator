/**
 *
 * @param {Map<string,any>} assignments
 * @param {string} path
 * @returns {boolean}
 */
export function existingAssignment(assignments, path) {
  let parts = path.split('.');

  function check(prefix, index) {
    if (index >= parts.length) {
      return false;
    }
    let part = parts[index];
    let [property,key] = part.split(':');

    let p = prefix ? `${prefix}.${property}` : property;

    if (assignments.has(p) || (key && assignments.has(`${p}:${key}`))) {
      return true;
    }
    if (check(p, index + 1)) {
      return true
    }
    if (key && check(`${p}:${key}`, index + 1)) {
      return true;
    }
    return false;
  }
  return check('', 0);
}

