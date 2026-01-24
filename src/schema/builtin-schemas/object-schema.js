import { Schema } from '../schema.js';
import { parse, stringify } from '../helpers/stringify.js';
import { ConstraintError } from '../../errors.js';

export const OBJECT_SCHEMA = new Schema()
  .option('type', 'object')
  .meta('valueName', 'object')
  .normalizer((value) => {
    if (value === true) {
      value = {};
    }
    if (typeof value === 'string') {
      // otherwise, we normalize as an object
      try {
        value = parse(value);
      }
      catch (error) {
        throw new ConstraintError(`Invalid input string for object: ${value}`, {cause: error});
      }
    }
    if (typeof value === 'object') {
      // if we need to be able to compare this value, it needs to be normalized as a string
      // fixme - attempting to not do this anymore
      //return Array.isArray(schema.values)? stringify(value) : value
      return value;
    }
    throw new ConstraintError(`Invalid input for object: ${value}`);
  })
  .transformer((value) => {
    if (value === true) {
      value = {};
    }
    if (typeof value === 'string') {
      try {
        value = parse(value.trim());
      }
      catch (error) {
        throw new ConstraintError(`Invalid serialized object: ${value}`, {cause: error});
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    throw new ConstraintError(`Invalid object: ${value}`)
  })
  .validator((value) => {
    if (typeof value !== 'object') {
      throw new ConstraintError(`Invalid object: ${value}`)
    }
    // NOTE: we let the schema validate object children; this should be used for specialization
    return value;
  })
