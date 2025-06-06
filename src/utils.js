
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

export function toConstantCase(str) {
  return wordsToConstantCase(normalizeToWords(str));
}

export function toKebabCase(str) {
  return wordsToKebabCase(normalizeToWords(str));
}

export function deepMerge(target, ...sources) {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

export function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function deepAssign(object, path, value) {
  if (!object || typeof object !== 'object') {
    throw new Error('First argument must be an object');
  }

  if (typeof path !== 'string' || path === '') {
    throw new Error('Path must be a non-empty string');
  }

  const keys = path.split('.');
  let current = object;

  // Navigate through all keys except the last one
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (!(key in current) || current[key] === null || current[key] === undefined) {
      // Key doesn't exist or is empty, create new object
      current[key] = {};
    } else if (typeof current[key] !== 'object') {
      // Key exists but is not an object
      throw new Error(`Cannot assign to path "${path}": key "${key}" exists but is not an object`);
    }

    current = current[key];
  }

  // Assign the value to the final key
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;

  return object;
}

/**
 * Convert value to specified type
 * @private
 */
export function convertValue(value, type) {
  switch (type) {
    case 'number':
      if (typeof value === 'number') return value;
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
      }
      return num;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      return Boolean(value);
    case 'array':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Handle comma-separated strings
        return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      return [value]; // Single value becomes array
    case 'string':
      return String(value);
    default:
      throw new Error(`Unknown schema value type '${type}'`)
  }
}
