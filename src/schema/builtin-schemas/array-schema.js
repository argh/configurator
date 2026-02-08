import { Schema } from '../schema.js';
import { parse, stringify } from '../helpers/stringify.js';
import { ConstraintError } from '../../errors.js';

export const ARRAY_SCHEMA = new Schema()
  .option('type', 'array')
  .normalizer((value, _, location) => {
    if (value === true) {
      value = [];
    }
    else if (value === '*' && location.schema.getPropertySchema('*')?.values?.length) {
      value = [...location.schema.getPropertySchema('*').values];
    }
    if (typeof value === 'string') {
      value = value.trim();
      if (value.length > 0 && value[0] === '[' && value[value.length - 1] === ']') {
        try {
          value = parse(value);
        }
        catch (error) {
          throw new ConstraintError(`Invalid input string for array: ${value}`);
        }
      }
      else {
        value = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    if (Array.isArray(value)) {
      // if we need to be able to compare this value, it needs to be normalized as a string
      // fixme - attempting to not do this anymore! return (Array.isArray(schema.values)? stringify(value) : value);
      return value;
    }
    throw new ConstraintError(`Invalid input for array: ${value}`)
  })
  .transformer((value, _, location) => {
    if (value === true) {
      value = [];
    }
    else if (value === '*' && location.schema.getPropertySchema('*')?.values?.length) {
      value = [...location.schema.getPropertySchema('*').values];
    }
    if (typeof value === 'string') {
      value = value.trim();
      try {
        value = parse(value);
      }
      catch (error) {
        throw new ConstraintError(`Invalid serialized array: ${value}`, {cause: error});
      }
    }
    if (Array.isArray(value)) {
      return value;
    }
    throw new ConstraintError(`Invalid array: ${value}`);
  })
  .validator((value, target, location) => {
    if (location.schema.hasChildren && location.schema.isOpaque) {
      return value;  // user needs to do their own validation!
    }
    if (!Array.isArray(value)) {
      throw new ConstraintError(`Invalid array: ${value}`)
    }
    // NOTE: we let the schema validate array elements; this should be used for specialization
    return value;
  })
