import { deepEquals } from "../../utils.js";
import { ConstraintError } from '../schema-errors.js';
import { formatValue } from '../../errors.js';

/**
 * **Processor**: `$eq`
 *
 * Do a deep equality check between the value and the provided constraint value.
 *
 * @type {import("../value-processor/value-processor.js").ValueProcessorDefinition}*
 */
export const EQ_CONSTRAINT = {
  keyword: 'eq',
  parameters: [ { parameter: 'value', required: true } ],

  process: (value, _target, location, options) => {
    const eqValue = options.args['value'];

    if (!deepEquals(value, eqValue)) {
      throw new ConstraintError(`Value ${formatValue(value)} was not equal to constraint`, {value, location});
    }
    return value;
  }
}
