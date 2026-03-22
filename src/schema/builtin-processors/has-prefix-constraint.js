import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * ## $has-prefix
 *
 * Check that the provided string value starts with the prefix value
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const HAS_PREFIX_CONSTRAINT = {
  keyword: 'has-prefix',
  parameters: [ { parameter: 'match', required: true } ],

  process: (value, _target, location, options) => {
    const prefix = options.args['match'];

    if (!`${value}`.startsWith(prefix)) {
      throw new ConstraintError(`Value ${formatValue(value)} did not start with prefix ${formatValue(prefix)}`, {location});
    }
    return value;
  }
}
