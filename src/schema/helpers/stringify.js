import { randomUUID } from 'node:crypto';

/**
 * Deterministic stringifier with support for extended types and deserialization.
 * @package
 * @param {*} value - Value to stringify
 * @param {Object} [options] - Stringification options
 * @param {number} [options.space] - Indentation for pretty printing (default: 0)
 * @param {number} [options.maxDepth=100] - Maximum recursion depth
 * @param {boolean} [options.useDelimiters=true] - Use <<Type>> markers for extended types
 * @param {string} [options.delimiterOpen='<<'] - Opening delimiter for type markers
 * @param {string} [options.delimiterClose='>>'] - Closing delimiter for type markers
 * @returns {string} Deterministic JSON string with optional type markers
 */
export function stringify(value, options = {}) {
  const {
    space = 0,
    maxDepth = 100,
    useDelimiters = true,
    delimiterOpen = '<<',
    delimiterClose = '>>'
  } = options;

  const seen = new WeakMap();
  const symbolIds = new WeakMap();

  /**
   * @param {string} type
   * @param {string|null} value
   * @returns {string|null}
   */
  const makeMarker = (type, value = null) => {
    if (!useDelimiters) {
      return null; // Signal to skip this value
    }
    return value !== null
           ? `${delimiterOpen}${type}: ${value}${delimiterClose}`
           : `${delimiterOpen}${type}${delimiterClose}`;
  };

  const getSymbolId = (sym) => {
    const description = sym.description;
    if (description !== undefined) {
      return description;
    }

    if (!symbolIds.has(sym)) {
      symbolIds.set(sym, randomUUID());
    }
    return symbolIds.get(sym);
  };

  const stringifyValue = (val, path = '$', depth = 0) => {
    if (depth > maxDepth) {
      return makeMarker('MaxDepth');
    }

    // Primitives
    if (val === null) return null;
    if (val === undefined) return makeMarker('undefined');
    if (typeof val === 'number') {
      if (Number.isNaN(val)) return makeMarker('NaN');
      if (val === Infinity) return makeMarker('Infinity');
      if (val === -Infinity) return makeMarker('-Infinity');
      return val;
    }
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val;
    if (typeof val === 'symbol') {
      return makeMarker('Symbol', getSymbolId(val));
    }
    if (typeof val === 'function') {
      return val.name ? makeMarker('Function', val.name) : makeMarker('undefined');
    }
    if (typeof val === 'bigint') {
      return makeMarker('BigInt', val.toString());
    }

    // Dates
    if (val instanceof Date) {
      const marker = makeMarker('Date', val.toISOString());
      return marker !== null ? marker : val.toISOString();
    }

    // Arrays
    if (Array.isArray(val)) {
      if (seen.has(val)) {
        return makeMarker('Circular', seen.get(val));
      }
      seen.set(val, path);

      const items = val.map((item, index) =>
        stringifyValue(item, `${path}[${index}]`, depth + 1)
      ).filter(item => item !== null || val.includes(null)); // Keep explicit nulls

      seen.delete(val);
      return items;
    }

    // Objects
    if (typeof val === 'object') {
      if (seen.has(val)) {
        return makeMarker('Circular', seen.get(val));
      }
      seen.set(val, path);

      const keys = Object.keys(val).sort();
      const result = {};

      for (const key of keys) {
        const keyPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
                        ? `${path}.${key}`
                        : `${path}[${JSON.stringify(key)}]`;
        const stringified = stringifyValue(val[key], keyPath, depth + 1);

        // Skip only marker nulls (stripped values), not actual nulls
        if (stringified !== null || val[key] === null) {
          result[key] = stringified;
        }
      }

      seen.delete(val);
      return result;
    }

    return null;
  };

  const result = stringifyValue(value);
  return JSON.stringify(result, null, space);
}

/**
 * Parse a string created by stringify() back into an object.
 * Handles both plain JSON and extended format with type markers.
 * @package
 * @param {string} text - JSON string to parse
 * @param {Object} [options] - Parse options
 * @param {string} [options.delimiterOpen='<<'] - Opening delimiter for type markers
 * @param {string} [options.delimiterClose='>>'] - Closing delimiter for type markers
 * @returns {*} Parsed value with extended types and circular references restored
 */
export function parse(text, options = {}) {
  const {
    delimiterOpen = '<<',
    delimiterClose = '>>'
  } = options;

  const parsed = JSON.parse(text);
  const pathMap = new Map();
  const circularRefs = [];

  // Escape regex special characters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markerPattern = new RegExp(
    `^${escapeRegex(delimiterOpen)}([^:${escapeRegex(delimiterClose)}]+)(?::\\s*(.+?))?${escapeRegex(delimiterClose)}$`
  );

  const parseMarker = (str) => {
    if (typeof str !== 'string') return null;
    const match = str.match(markerPattern);
    if (!match) return null;
    return { type: match[1], value: match[2] };
  };

  const revive = (val, path = '$') => {
    // Check for marker strings
    const marker = parseMarker(val);
    if (marker) {
      switch (marker.type) {
        case 'undefined': return undefined;
        case 'NaN': return NaN;
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
        case 'BigInt': return BigInt(marker.value);
        case 'Date': return new Date(marker.value);
        case 'Symbol': return Symbol.for(marker.value);
        case 'Function': return null;
        case 'MaxDepth': return null;
        case 'Circular':
          circularRefs.push({ targetPath: path, sourcePath: marker.value });
          return null;
      }
    }

    if (val === null || typeof val !== 'object') {
      return val;
    }

    // Arrays
    if (Array.isArray(val)) {
      const arr = [];
      pathMap.set(path, arr);

      val.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        arr[index] = revive(item, itemPath);
      });

      return arr;
    }

    // Objects
    const obj = {};
    pathMap.set(path, obj);

    for (const [key, value] of Object.entries(val)) {
      const keyPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
                      ? `${path}.${key}`
                      : `${path}[${JSON.stringify(key)}]`;
      obj[key] = revive(value, keyPath);
    }

    return obj;
  };

  const result = revive(parsed);

  // Second pass: resolve circular references
  for (const { targetPath, sourcePath } of circularRefs) {
    const target = resolvePath(result, targetPath);
    const source = pathMap.get(sourcePath);

    if (target && source) {
      setPath(target.obj, target.key, source);
    }
  }

  return result;
}

/**
 * Resolve a JSONPath to an object and key
 * @param {*} root - Root object
 * @param {string} path - Path to resolve
 * @returns {{obj: object, key: string|number}|null}
 */
function resolvePath(root, path) {
  if (path === '$') {
    return null;
  }

  const parts = parsePath(path);
  let current = root;

  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
    if (current === null || current === undefined) {
      return null;
    }
  }

  return { obj: current, key: parts[parts.length - 1] };
}

/**
 * Set a value at the given object/key
 * @param {object} obj - Parent object
 * @param {string|number} key - Key to set
 * @param {*} value - Value to set
 */
function setPath(obj, key, value) {
  obj[key] = value;
}

/**
 * Parse a JSONPath into an array of keys
 * @param {string} path - Path like $.foo.bar[0].baz
 * @returns {Array<string|number>}
 */
function parsePath(path) {
  const parts = [];
  let current = '';
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '$' && i === 0) {
      continue;
    }

    if (char === '.' && !inBracket) {
      if (current) parts.push(current);
      current = '';
    } else if (char === '[') {
      if (current) parts.push(current);
      current = '';
      inBracket = true;
    } else if (char === ']') {
      if (inBracket) {
        const trimmed = current.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          parts.push(JSON.parse(trimmed));
        } else {
          parts.push(Number(trimmed));
        }
        current = '';
        inBracket = false;
      }
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);

  return parts;
}