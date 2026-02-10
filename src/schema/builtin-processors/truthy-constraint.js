import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$truthy`
 *
 * Validates that the value is "truthy".  Note that the Configurator interpretation of "truthy" honors
 * the boolean schema normalization values of certain special strings:
 *
 *   The strings "false", "0", and "no" are all treated as false.
 *
 *
 *       const lower = value.toLowerCase();
 *       if (lower === 'true' || lower === '1' || lower === 'yes') return true;
 *       if (lower === 'false' || lower === '0' || lower === 'no') return false;
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('number').validator('$truthy')
 * ```
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const TRUTHY_CONSTRAINT = {
  keyword: 'truthy',
  processor: (value) => {
    let truthy = Boolean(value);

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'false' || lower === '0' || lower === 'no') {
        truthy = false;
      }
    }
    if (truthy) {
      return value;
    }
    throw new ConstraintError('Must be truthy');
  }
};
