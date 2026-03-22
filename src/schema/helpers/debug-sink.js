
const DEBUG_SINK = Symbol.for('@versionzero/debug-sink');

/**
 * A hook for compatible loggers (e.g., `@versionzero/logger`) to automatically capture debug messages.
 * (Left in for new code hacking; debug calls were removed for performance reasons after the library was stabilized.)
 *
 * @param {...any} args
 * @package
 * @deprecated
 */
export function debug(...args) {
  const sink = (globalThis)[DEBUG_SINK] ?? console.log;
  sink?.(...args);
}
