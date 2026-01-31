
// Utility function to normalize any case format to an array of words
function normalizeToWords(str) {
  // Handle empty or non-string input
  if (!str || typeof str !== 'string') return [];

  // Split on common delimiters and word boundaries
  return str
    // Split on non-alphanumeric characters (handles kebab-case, snake_case, etc.)
    .split(/[^a-zA-Z0-9]+/)
    // Split on lowercase-to-uppercase transitions (but not uppercase-to-uppercase)
    .flatMap(part => part.split(/(?<=[a-z])(?=[A-Z])/))
    .flatMap(part => part.split(/(?<=[0-9])(?=[A-Za-z])/))
    // Filter out empty strings and convert to lowercase
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase());
}

// Convert normalized words array to camelCase
function wordsToCamelCase(words) {
  if (words.length === 0) return '';
  return words[0] + words.slice(1).map(word =>
         word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
}

// Convert normalized words array to camelCase
function wordsToPascalCase(words) {
  if (words.length === 0) return '';
  return words.map(word =>
         word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
}

function wordsToHeadline(words) {
  if (words.length === 0) return '';
  return words.map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

}

// Convert normalized words array to CONSTANT_CASE
function wordsToConstantCase(words) {
  return words.map(word => word.toUpperCase()).join('_');
}

// Convert normalized words array to kebab-case
function wordsToKebabCase(words) {
  return words.map(word => word.toLowerCase()).join('-');
}

// Main conversion functions
export function toCamelCase(str) {
  return wordsToCamelCase(normalizeToWords(str));
}

export function toPascalCase(str) {
  return wordsToPascalCase(normalizeToWords(str));
}

export function toConstantCase(str) {
  return wordsToConstantCase(normalizeToWords(str));
}

export function toKebabCase(str) {
  return wordsToKebabCase(normalizeToWords(str));
}

export function toHeadline(str) {
  return wordsToHeadline(normalizeToWords(str));
}

export function isPlainObject(obj) {
  if (obj == null || typeof obj !== 'object') return false;

  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

export function isObject(item) {
  // todo - should we allow 'function'?
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function isPrimitive(item) {
  if (item === undefined || item === null) {
    return false; // these values have special meaning for this library and are thus not assignable primitives!
  }
  const type = typeof item;
  return type !== 'object' && type !== 'function';
}

export function isConstructor(f) {
  if (typeof f !== 'function') {
    return false;
  }
  if (f.prototype?.constructor === f) {
    return true;
  }
  try {
    class test extends f {}
  }
  catch (err) {
    return false;
  }
  return true;
}

export function deepMerge(target, ...sources) {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * deep comparison
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 * @internal
 */
export function deepEquals(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) || Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const k of keys) {
      if (!b.hasOwnProperty(k) || !deepEquals(a[k], b[k])) return false;
    }
    return true;
  }

  return false;
}

export function deepAssign(target, path, value) {
  if (path === '' && target) {
    throw new Error('Top level path but target is already set');
  }
  if (path === '') {
    if (Array.isArray(value)) {
      return [...value];
    }
    else if (isPlainObject(value)) {
      return {...value};
    }
    return value;
  }
  // Handle edge cases
  if (!path || typeof path !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  // Split the path by dots and filter out empty segments
  const segments = path.split('.').filter(segment => segment !== '');

  if (segments.length === 0) {
    throw new Error('Path must contain at least one valid segment');
  }

  if (target !== null && target !== undefined && typeof target !== 'object') {
    throw new Error('Target must be an object, an array, or null/undefined');
  }

  // Auto-synthesize target if null
  if (target === null || target === undefined) {
    const firstSegment = segments[0];
    const isFirstArrayIndex = /^\d+$/.test(firstSegment);
    target = isFirstArrayIndex ? [] : {};
  }

  let current = target;

  // Navigate to the parent of the target property
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    // Check if current segment is an array index
    const isArrayIndex = /^\d+$/.test(segment);
    const nextIsArrayIndex = /^\d+$/.test(nextSegment);

    if (isArrayIndex) {
      const index = parseInt(segment, 10);

      // Ensure current is an array
      if (!Array.isArray(current)) {
        throw new Error(`Expected array at path segment '${segments.slice(0, i).join('.')}', but found ${typeof current}`);
      }

      // Extend array if necessary
      while (current.length <= index) {
        current.push(undefined);
      }

      // Create the next level if it doesn't exist
      if (current[index] === undefined || current[index] === null) {
        current[index] = nextIsArrayIndex ? [] : {};
      }

      current = current[index];
    } else {
      // Handle object property
      if (current[segment] === undefined || current[segment] === null) {
        current[segment] = nextIsArrayIndex ? [] : {};
      }

      current = current[segment];
    }
  }

  // Set the final value
  const finalSegment = segments[segments.length - 1];
  const isFinalArrayIndex = /^\d+$/.test(finalSegment);

  if (isFinalArrayIndex) {
    const index = parseInt(finalSegment, 10);

    // Ensure current is an array
    if (!Array.isArray(current)) {
      throw new Error(`Expected array at path segment '${segments.slice(0, -1).join('.')}', but found ${typeof current}`);
    }

    // Extend array if necessary
    while (current.length <= index) {
      current.push(undefined);
    }

    current[index] = value;
  } else {
    current[finalSegment] = value;
  }

  return target;
}

export function deepValue(object, path) {
  if (path === '') {
    return object;
  }

  // Handle null/undefined object
  if (!object || typeof object !== 'object') {
    return undefined;
  }


  // Handle empty or invalid path
  if (typeof path !== 'string') {
    return undefined;
  }

  // Split the path and filter out empty strings
  const keys = path.split('.').filter(key => key.length > 0);

  // If no valid keys, return undefined
  if (keys.length === 0) {
    return undefined;
  }

  // Traverse the object following the path
  let current = object;
  for (const key of keys) {
    // Check if current is null/undefined or not an object
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    // Move to the next level
    if (/^\d+$/.test(key)) {
      current = current[Number(key)]
    }
    else {
      current = current[key];
    }
  }

  return current;
}


export function deepPrune(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (deepPrune(value[key]) === undefined) {
        delete value[key];
      }
    }
    return Object.keys(value).length? value : undefined;
  }
  else if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      let v = deepPrune(value[i]);
      if (v === undefined) {
        if (i === value.length - 1) {
          value.pop();
        } else {
          delete value[i];
        }
      }
      else if (v !== value[i]) {
        // avoid reassigning unless actually changed (e.g. proxy)
        value[i] = v;
      }
    }
    return value.length ? value : undefined;
  }
  else {
    return value;
  }
}

/**
 * Split off the first section of a path
 *
 * @param {string} path
 * @returns {[string,string|undefined]}
 */
export function behead(path) {
  if (path === '') {
    return ['', undefined];
  }
  const dot = path.indexOf('.');

  return (dot === -1)? [path, ''] : [path.slice(0, dot), path.slice(dot + 1)];
}

/**
 * Extract the last part of the path
 * @param {string} path
 */
export function propertyName(path) {
  const dot = path.lastIndexOf('.');

  if (dot === -1) {
    return path;
  }
  return path.slice(dot + 1);
}