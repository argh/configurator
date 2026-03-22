import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $abs
 *
 * Returns the absolute value of a number.
 *
 * ### Example
 * ```js
 * // Normalize a signed offset to always be non-negative
 * new Schema('number').transformer('$abs')
 *
 * // Ensure a distance value is always positive
 * new Schema('object', {
 *   distance: new Schema('number').transformer('$abs'),
 * })
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const ABS_OPERATOR = {
  keyword: 'abs',

  process: (value, _target, location) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConstraintError(`$abs requires a finite number, got ${formatValue(value)}`, {location});
    }
    return Math.abs(value);
  }
};

/**
 * ## $pow
 *
 * Raises a number to a power.
 *
 * - `{$pow: exponent}` — raises the input value to the given exponent
 * - `{$pow: {exponent, base}}` — raises `base` to `exponent`, ignoring the input value
 *
 * ### Parameters
 * - `exponent` (number, required): The exponent.
 * - `base` (number, optional): Override the base. Defaults to the input value.
 *
 * ### Example
 * ```js
 * // Square the input value
 * new Schema('number').transformer({$pow: {exponent: 2}})
 * // 4 → 16, 3 → 9
 *
 * // Compute 2^n where n is the input
 * new Schema('number').transformer({$pow: {exponent: '$number', base: 2}})
 *
 * // Convert bytes to kilobytes using inverse power
 * new Schema('number').transformer({$pow: {exponent: -1}})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const POW_OPERATOR = {
  keyword: 'pow',
  parameters: [ { parameter: 'exponent', required: true }, { parameter: 'base' } ],

  process: (value, _target, location, options) => {
    const exponent = options.args['exponent'];
    const base = options.args['base'] !== undefined ? options.args['base'] : value;

    if (typeof base !== 'number' || !Number.isFinite(base)) {
      throw new ConstraintError(`$pow requires a finite number base, got ${formatValue(base)}`, {location});
    }
    return Math.pow(base, exponent);
  }
};

/**
 * ## $sqrt
 *
 * Returns the square root of a number.
 *
 * ### Example
 * ```js
 * // Compute the magnitude of a value
 * new Schema('number').transformer('$sqrt')
 *
 * // Validate then take the square root
 * new Schema('number').validator('$positive').transformer('$sqrt')
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const SQRT_OPERATOR = {
  keyword: 'sqrt',

  process: (value, _target, location) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ConstraintError(`$sqrt requires a non-negative finite number, got ${formatValue(value)}`, {location});
    }
    return Math.sqrt(value);
  }
};

/**
 * ## $clamp
 *
 * Constrains a number to a `[min, max]` range by returning the nearest boundary when the value
 * falls outside. Unlike `$range` (which throws), `$clamp` transforms.
 *
 * Both `min` and `max` are optional; omitting either leaves that end unclamped.
 *
 * ### Parameters
 * - `min` (number, optional): Lower bound.
 * - `max` (number, optional): Upper bound.
 *
 * ### Example
 * ```js
 * // Clamp a volume setting to [0, 100]
 * new Schema('number').transformer({$clamp: {min: 0, max: 100}})
 *
 * // Clamp retry count to at most 10 (no lower bound)
 * new Schema('number').transformer({$clamp: {max: 10}})
 *
 * // Ensure a timeout is at least 100ms
 * new Schema('number').transformer({$clamp: {min: 100}})
 * ```
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const CLAMP_OPERATOR = {
  keyword: 'clamp',
  parameters: [ { parameter: 'min' }, { parameter: 'max' } ],

  process: (value, _target, location, options) => {
    const min = options.args['min'];
    const max = options.args['max'];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConstraintError(`$clamp requires a finite number, got ${formatValue(value)}`, {location});
    }
    if (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) {
      throw new ConstraintError(`$clamp min must be a finite number, got ${formatValue(min)}`, {location});
    }
    if (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max))) {
      throw new ConstraintError(`$clamp max must be a finite number, got ${formatValue(max)}`, {location});
    }

    let result = value;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  }
};
