/**
 * ## $type
 *
 * Returns the type name of the input value as a string. Unlike the `$is-*` constraint family,
 * this operator produces the type name as a value usable in pipelines and templates.
 *
 * **Return values**: `'string'`, `'number'`, `'boolean'`, `'array'`, `'object'`, `'date'`, `'null'`, `'undefined'`
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const TYPE_OPERATOR = {
  keyword: 'type',

  process: (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
};
