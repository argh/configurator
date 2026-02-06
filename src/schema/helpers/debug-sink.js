
const DEBUG_SINK = Symbol.for('@versionzero/debug-sink');

/**
 * @param {...any} args
 */
export function debug(...args) {
  const sink = (globalThis)[DEBUG_SINK] ?? console.log;
  sink?.(...args);
}
