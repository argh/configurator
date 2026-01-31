import { Schema } from '../schema.js';

export const ANY_SCHEMA = new Schema()
  .option('type', 'any')
  .normalizer((value, _, location) => {
    if (value === true) {
      const schema = location.schema;
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (hasChildren) {
        const check = s => {
          return Object.keys(s.properties).some(k => !/^[\d*]/.test(k));
        }

        const hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

        return hasStringProps ? {} : [];
      }
    }
    return value;
  })
  .transformer((value, _, location) => {
    const schema = location.schema;
    if (value === true) {
      const hasChildren = Boolean(schema?.hasChildren || schema?.isUnion && Object.values(schema.unionSchemas).find(s => s.hasChildren))

      if (hasChildren) {
        const check = s => Object.keys(s.properties).some(k => !/^[\d*]/.test(k));

        const hasStringProps = [schema, ...Object.values(schema.unionSchemas)].some(check);

        return hasStringProps ? {} : [];
      }
    }
    return value;
  })