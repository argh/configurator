import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$abs`
 *
 * Returns the absolute value of a number.
 *
 * **Input**: `-5` → **Output**: `5`
 * **Input**: `3.14` → **Output**: `3.14`
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
 * **Processor**: `$pow`
 *
 * Raises a number to a power.
 *
 * - `{$pow: exponent}` — raises the input value to the given exponent
 * - `{$pow: {exponent, base}}` — raises `base` to `exponent`, ignoring the input value
 *
 * **Parameters**:
 * - `exponent` (number, required): The exponent.
 * - `base` (number, optional): Override the base. Defaults to the input value.
 *
 * **Input**: `2` with `{$pow: 10}` → **Output**: `1024`
 * **Input**: any with `{$pow: {exponent: 8, base: 2}}` → **Output**: `256`
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
 * **Processor**: `$sqrt`
 *
 * Returns the square root of a number.
 *
 * **Input**: `9` → **Output**: `3`
 * **Input**: `2` → **Output**: `1.4142135623730951`
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
 * **Processor**: `$clamp`
 *
 * Constrains a number to a `[min, max]` range by returning the nearest boundary when the value
 * falls outside. Unlike `$range` (which throws), `$clamp` transforms.
 *
 * Both `min` and `max` are optional; omitting either leaves that end unclamped.
 *
 * **Parameters**:
 * - `min` (number, optional): Lower bound.
 * - `max` (number, optional): Upper bound.
 *
 * **Input**: `150` with `{$clamp: {min: 0, max: 100}}` → **Output**: `100`
 * **Input**: `-5` with `{$clamp: {min: 0}}` → **Output**: `0`
 * **Input**: `42` with `{$clamp: {min: 0, max: 100}}` → **Output**: `42`
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
