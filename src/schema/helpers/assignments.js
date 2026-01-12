/**
 *
 * @param {Map<string,any>} assignments
 * @param {string} path
 * @returns {boolean}
 */
export function existingAssignment(assignments, path) {
  const parts = path.split('.');

  function check(prefix, index) {
    if (index >= parts.length) {
      return false;
    }
    const property = parts[index];

    const p = prefix ? `${prefix}.${property}` : property;

    if (assignments.has(p)) {
      return true;
    }
    return check(p, index + 1);
  }
  return check('', 0);
}

