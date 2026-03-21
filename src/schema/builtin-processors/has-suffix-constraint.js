import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$has-suffix`
 *
 * Check that the provided string value ends with the suffix value
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const HAS_SUFFIX_CONSTRAINT = {
  keyword: 'has-suffix',
  parameters: [ { parameter: 'match', required: true } ],

  process: (value, _target, location, options) => {
    const suffix = options.args['match'];

    if (!`${value}`.endsWith(suffix)) {
      throw new ConstraintError(`Value ${formatValue(value)} did not end with suffix ${formatValue(suffix)}`, {location});
    }
    return value;
  }
}
