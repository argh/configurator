import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$sum`
 *
 * Returns the sum of an array of numbers. Returns `0` for an empty array.
 *
 * **Input**: `[1, 2, 3]` → **Output**: `6`
 * **Input**: `[]` → **Output**: `0`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const SUM_OPERATOR = {
  keyword: 'sum',

  process: (value, _target, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$sum requires an array, got ${formatValue(value)}`, {location});
    }
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        throw new ConstraintError(`$sum requires an array of finite numbers, got ${formatValue(value[i])} at index ${i}`, {location});
      }
      sum += value[i];
    }
    return sum;
  }
};

/**
 * **Processor**: `$min`
 *
 * Returns the minimum value from an array of numbers. Returns `undefined` for an empty array.
 *
 * **Input**: `[3, 1, 2]` → **Output**: `1`
 * **Input**: `[]` → **Output**: `undefined`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MIN_OPERATOR = {
  keyword: 'min',

  process: (value, _target, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$min requires an array, got ${formatValue(value)}`, {location});
    }
    if (value.length === 0) return undefined;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        throw new ConstraintError(`$min requires an array of finite numbers, got ${formatValue(value[i])} at index ${i}`, {location});
      }
    }
    return Math.min(...value);
  }
};

/**
 * **Processor**: `$max`
 *
 * Returns the maximum value from an array of numbers. Returns `undefined` for an empty array.
 *
 * **Input**: `[3, 1, 2]` → **Output**: `3`
 * **Input**: `[]` → **Output**: `undefined`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const MAX_OPERATOR = {
  keyword: 'max',

  process: (value, _target, location) => {
    if (!Array.isArray(value)) {
      throw new ConstraintError(`$max requires an array, got ${formatValue(value)}`, {location});
    }
    if (value.length === 0) return undefined;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        throw new ConstraintError(`$max requires an array of finite numbers, got ${formatValue(value[i])} at index ${i}`, {location});
      }
    }
    return Math.max(...value);
  }
};
