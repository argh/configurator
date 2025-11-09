/**
 * Expands wildcard paths in a map of dot-notation assignments to concrete paths
 * based on existing non-wildcard paths. Preserves union selection keys (colon-delimited).
 *
 * @param {Map<string, any>} assignments - Map of path strings to values
 * @returns {Map<string, any>} New map with wildcards expanded to concrete paths
 */
export function expandWildcards(assignments) {
  const result = new Map();
  const wildcardEntries = [];
  const concreteEntries = [];

  // Separate wildcard and concrete entries
  for (const [path, value] of assignments) {
    if (path.includes('*')) {
      wildcardEntries.push([path, value]);
    } else {
      concreteEntries.push([path, value]);
//      result.set(path, value);
    }
  }

  // Expand each wildcard entry
  for (const [wildcardPath, value] of wildcardEntries) {
    const expanded = expandSingleWildcard(wildcardPath, concreteEntries);
    for (const concretePath of expanded) {
      result.set(concretePath, value);
    }
  }

  return result;
}

/**
 * Expands a single wildcard path against all concrete paths
 *
 * @param {string} wildcardPath - Path containing one or more '*' wildcards
 * @param {Array<[string, any]>} concreteEntries - Array of [path, value] tuples
 * @returns {Set<string>} Set of concrete paths matching the wildcard pattern
 */
function expandSingleWildcard(wildcardPath, concreteEntries) {
  const wildcardSegments = wildcardPath.split('.');
  const matches = new Set();

  for (const [concretePath] of concreteEntries) {
    const concreteSegments = concretePath.split('.');
    const matchedPrefix = pathMatchesPrefix(wildcardSegments, concreteSegments);
    if (matchedPrefix !== null) {
      matches.add(buildMatchingPath(wildcardSegments, matchedPrefix));
    }
  }

  return matches;
}

/**
 * Parses a segment into base and optional union key
 *
 * @param {string} segment - Segment like "2" or "2:complex"
 * @returns {{base: string, unionKey: string|null}} Parsed components
 */
function parseSegment(segment) {
  const colonIdx = segment.indexOf(':');
  if (colonIdx === -1) {
    return { base: segment, unionKey: null };
  }
  return {
    base: segment.slice(0, colonIdx),
    unionKey: segment.slice(colonIdx + 1)
  };
}

/**
 * Checks if a concrete path's prefix matches a wildcard pattern.
 * Returns the matched prefix segments if successful, null otherwise.
 *
 * Only requires matching up to and including the last wildcard position.
 * Remaining literal segments after the last wildcard are not required to match.
 *
 * @param {string[]} wildcardSegments - Pattern segments (may contain '*')
 * @param {string[]} concreteSegments - Concrete path segments
 * @returns {string[]|null} Matched prefix segments, or null if no match
 */
function pathMatchesPrefix(wildcardSegments, concreteSegments) {
  const matched = [];

  // Find the position of the last wildcard
  let lastWildcardIndex = -1;
  for (let i = 0; i < wildcardSegments.length; i++) {
    const parsed = parseSegment(wildcardSegments[i]);
    if (parsed.base === '*') {
      lastWildcardIndex = i;
    }
  }

  // Only require matching up to and including the last wildcard
  const requiredMatchLength = lastWildcardIndex + 1;

  // Concrete path must have at least enough segments to match up to last wildcard
  if (concreteSegments.length < requiredMatchLength) {
    return null;
  }

  // Match segments up to and including the last wildcard
  for (let i = 0; i < requiredMatchLength; i++) {
    const wildParsed = parseSegment(wildcardSegments[i]);
    const concreteParsed = parseSegment(concreteSegments[i]);

    if (wildParsed.base === '*') {
      // Wildcard matches any base, but check union key compatibility
      if (wildParsed.unionKey !== null) {
        // If wildcard specifies a union key, concrete must either:
        // 1. Have no union key (we'll add it), OR
        // 2. Have the same union key
        if (concreteParsed.unionKey !== null &&
            concreteParsed.unionKey !== wildParsed.unionKey) {
          return null; // Conflicting union keys
        }
      }
      matched.push(concreteSegments[i]);
    } else {
      // Literal segment - must match base exactly
      if (wildParsed.base !== concreteParsed.base) {
        return null;
      }

      // Check union key compatibility
      if (wildParsed.unionKey !== null) {
        if (concreteParsed.unionKey !== null &&
            concreteParsed.unionKey !== wildParsed.unionKey) {
          return null; // Conflicting union keys
        }
      }

      matched.push(concreteSegments[i]);
    }
  }

  return matched;
}

/**
 * Builds a concrete path by replacing wildcards with matched segments
 *
 * @param {string[]} wildcardSegments - Pattern segments (may contain '*')
 * @param {string[]} matchedPrefix - Matched concrete prefix segments (up to last wildcard)
 * @returns {string} Complete concrete path with all wildcards replaced
 */
function buildMatchingPath(wildcardSegments, matchedPrefix) {
  const result = [];

  // Find the position of the last wildcard
  let lastWildcardIndex = -1;
  for (let i = 0; i < wildcardSegments.length; i++) {
    const parsed = parseSegment(wildcardSegments[i]);
    if (parsed.base === '*') {
      lastWildcardIndex = i;
    }
  }

  const requiredMatchLength = lastWildcardIndex + 1;

  // Build path up to and including last wildcard using matched prefix
  for (let i = 0; i < requiredMatchLength; i++) {
    const wildParsed = parseSegment(wildcardSegments[i]);
    const concreteParsed = parseSegment(matchedPrefix[i]);

    if (wildParsed.base === '*') {
      // Replace wildcard base with concrete base
      const base = concreteParsed.base;
      // Prefer wildcard's union key, fallback to concrete's
      const unionKey = wildParsed.unionKey !== null ? wildParsed.unionKey : concreteParsed.unionKey;
      result.push(unionKey !== null ? `${base}:${unionKey}` : base);
    } else {
      // Literal segment from wildcard pattern
      // If wildcard has union key and concrete doesn't, add it
      const base = wildParsed.base;
      const unionKey = wildParsed.unionKey !== null ? wildParsed.unionKey : concreteParsed.unionKey;
      result.push(unionKey !== null ? `${base}:${unionKey}` : base);
    }
  }

  // Append remaining literal segments from wildcard pattern
  for (let i = requiredMatchLength; i < wildcardSegments.length; i++) {
    result.push(wildcardSegments[i]);
  }

  return result.join('.');
}
