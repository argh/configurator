import { ConstraintError, SchemaError } from '../schema-errors.js';
import { FunctionValueProcessor } from '../value-processor/function-value-processor.js';
import { ComposedValueProcessor } from '../value-processor/composed-value-processor.js';

/**
 * ## $template
 *
 * Operator that interpolates a template string using properties from the input object.
 * Placeholders use `{key}` syntax; double braces `{{` and `}}` are literal brace escapes.
 *
 * The input must be a plain object. Unknown keys resolve to an empty string.
 *
 * ### Parameters
 * - `template` (string, required): The template string to interpolate.
 *
 * @type {import('../value-processor/value-processor.js').ValueProcessorDefinition}
 */
export const TEMPLATE_OPERATOR = {
  keyword: 'template',
  build: (args) => {
    const template = (Array.isArray(args) ? args[0] : args)?.spec;
    if (typeof template !== 'string') {
      throw new SchemaError('$template requires a string argument');
    }
    const fn = new FunctionValueProcessor((value, _target, location) => {
      if (typeof value !== 'object' || value === null) {
        throw new ConstraintError('$template requires an object input', {location});
      }
      return template
        .replace(/\{\{/g, '\x00')
        .replace(/\}\}/g, '\x01')
        .replace(/\{([^}]+)\}/g, (_, key) => {
          const v = value[key];
          return v === undefined ? '' : String(v);
        })
        .replace(/\x00/g, '{')
        .replace(/\x01/g, '}');
    });
    fn.description = template;
    return new ComposedValueProcessor(fn, {$template: template});
  }
};
