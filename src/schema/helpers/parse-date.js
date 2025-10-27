import { TransformError } from '../../errors.js';

/**
 * @package
 * @param {string|number|Date} value
 * @returns {Date}
 */
export function parseDate(value) {
  if (value === 'now') {
    return new Date();
  }

  if (typeof value === 'string') {
    // Handle relative time deltas: +24h, -1d, etc.
    const deltaMatch = value.match(/^([+-])(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/);
    if (deltaMatch) {
      const [, sign, amount, unit] = deltaMatch;
      const multiplier = sign === '+' ? 1 : -1;
      const num = parseFloat(amount) * multiplier;

      const unitMs = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
      };

      return new Date(Date.now() + (num * unitMs[unit]));
    }

    // Check if it's a numeric string (timestamp)
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && isFinite(numericValue) && /^\d+(\.\d+)?$/.test(value.trim())) {
      // Treat as numeric timestamp, apply same seconds/milliseconds logic
      let timestamp = numericValue;
      if (numericValue > 0 && numericValue < 2524608000 && numericValue < 1000000000000) {
        timestamp = numericValue * 1000;
      }
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new TransformError(`Invalid date value: ${value}`);
      }
      return date;
    }

    // Fall back to standard Date parsing for ISO strings, etc.
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new TransformError(`Invalid date value: ${value}`);
    }
    return date;
  }

  if (typeof value === 'number') {
    // Auto-detect seconds vs. milliseconds for reasonable ranges
    // (If it's close to the epoch when interpreted as milliseconds, it's probably seconds.)
    const date = new Date(Math.abs(value) < 200000000 ? value * 1000 : value)

    if (isNaN(date.getTime())) {
      throw new TransformError(`Invalid date value: ${value}`);
    }
    return date;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new TransformError(`Invalid Date object: ${value}`);
    }
    return new Date(value.getTime()); // defensive copy
  }

  throw new TransformError(`Invalid date value: ${value} (${typeof value})`);
}