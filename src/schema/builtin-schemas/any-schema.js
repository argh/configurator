import { Schema } from '../schema.js';

export const ANY_SCHEMA = new Schema()
  .option('type', 'any')
  .normalizer((value, _, schema) => {
    if (value === true) {
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (hasChildren) {
        let check = s => {
          return Object.keys(s.properties).some(k => !/^[\d*]/.test(k));
        }

        let hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

        return hasStringProps ? {} : [];
      }
    }
    return value;
  })
  .transformer((value, _, schema) => {
    if (value === true) {
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (hasChildren) {
        let check = s => Object.keys(s.properties).some(k => !/^[\d*]/.test(k));

        let hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

        return hasStringProps ? {} : [];
      }
    }
    return value;
  })