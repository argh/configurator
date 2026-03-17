import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$prefix`
 *
 * Check that the provided string value starts with the prefix value
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const SUFFIX_CONSTRAINT = {
  keyword: 'suffix',
  parameters: [ { parameter: 'match', required: true } ],

  process: (value, _target, location, options) => {
    const suffix = options.args['match'];

    if (!`${value}`.endsWith(suffix)) {
      throw new ConstraintError(`Value ${formatValue(value)} did not end with suffix ${formatValue(suffix)}`, {location});
    }
    return value;
  }
}
