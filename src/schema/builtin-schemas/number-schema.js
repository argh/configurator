import { Schema } from '../schema.js';
import { ConstraintError } from '../../errors.js';

export const NUMBER_SCHEMA = new Schema()
  .option('type', 'number')
  .meta('valueName', 'number')
  .normalizer((value) => {
    if (typeof value === 'number') return value;
    const num = Number(value);
    if (isNaN(num)) throw new ConstraintError(`Invalid input for number: ${value}`);
    return num;
  })
  .validator((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    throw new ConstraintError(`Invalid number: ${value}`);
  })
