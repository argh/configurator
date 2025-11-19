
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Schema Compilation - Inheritance', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Inheriting from base type strings', function() {

    it('should inherit normalizer from string base', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalize(42), '42');
      assert.strictEqual(await compiled.normalize(true), 'true');
    });

    it('should inherit validator from number base', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(42, {}, compiled, '');
      assert.strictEqual(result, 42);
    });

    it('should inherit transformer from boolean base', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      const result = await compiled.transform(true, {}, '');
      assert.strictEqual(result, true);
    });

    it('should inherit all handlers from object base', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalize({});
      const transformed = await compiled.transform({}, {}, '');
      const validated = await compiled.validate({}, {}, compiled, '');
      assert.deepStrictEqual(normalized, {});
      assert.deepStrictEqual(transformed, {});
      assert.deepStrictEqual(validated, {});
    });
  });

  describe('Local options take precedence over base', function() {

    it('should use local normalizer over base normalizer', async function() {
      const customNormalizer = (v) => `CUSTOM:${v}`;
      const schema = new Schema('string')
        .normalizer(customNormalizer);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalize('test'), 'CUSTOM:test');
    });

    it('should use local validator over base validator', async function() {
      const customValidator = (v) => {
        if (v !== 'valid') throw new Error('Not valid');
        return v;
      };
      const schema = new Schema('string')
        .validator(customValidator);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('invalid', {}, compiled, ''),
        ValidationError
      );

      const result = await compiled.validate('valid', {}, compiled, '');
      assert.strictEqual(result, 'valid');
    });

    it('should use local transformer over base transformer', async function() {
      const customTransformer = (v) => `transformed-${v}`;
      const schema = new Schema('string')
        .transformer(customTransformer);

      const compiled = await resolver.compile(schema);

      const result = await compiled.transform('input', {}, 'field');
      assert.strictEqual(result, 'transformed-input');
    });

    it('should use local serializer over base serializer', async function() {
      const customSerializer = (v) => `serialized:${v}`;
      const schema = new Schema('string')
        .serializer(customSerializer);

      const compiled = await resolver.compile(schema);

      const result = await compiled.serialize('data');
      assert.strictEqual(result, 'serialized:data');
    });
  });

  describe('Local metadata takes precedence', function() {

    it('should override valueName from base', async function() {
      const schema = new Schema('string')
        .meta('valueName', 'custom-value-name');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'custom-value-name');
    });

    it('should override valueDescription from base', async function() {
      const schema = new Schema('boolean')
        .meta('valueDescription', 'yes or no');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'yes or no');
    });

    it('should supplement base metadata with additional fields', async function() {
      const schema = new Schema('string')
        .meta('description', 'A custom string field')
        .meta('example', 'hello');

      const compiled = await resolver.compile(schema);

      // Should have both base metadata and custom metadata
      assert.strictEqual(compiled.metadata.valueName, 'string'); // from base
      assert.strictEqual(compiled.metadata.description, 'A custom string field'); // custom
      assert.strictEqual(compiled.metadata.example, 'hello'); // custom
    });
  });

  describe('Inheriting from Schema instances', function() {

    it('should inherit from another Schema instance', async function() {
      const baseSchema = new Schema('string')
        .meta('category', 'text');

      const derivedSchema = new Schema(baseSchema)
        .meta('description', 'Extended from base');

      const compiled = await resolver.compile(derivedSchema);

      // Should have metadata from both schemas
      assert.strictEqual(compiled.metadata.category, 'text');
      assert.strictEqual(compiled.metadata.description, 'Extended from base');
      // Should also have base type metadata
      assert.strictEqual(compiled.metadata.valueName, 'string');
    });

    it('should inherit properties from Schema base', async function() {
      const baseSchema = new Schema('object')
        .property('id', new Schema('number'));

      const derivedSchema = new Schema(baseSchema)
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(derivedSchema);

      // Should have properties from both
      assert.ok(compiled.properties.id);
      assert.ok(compiled.properties.name);
    });

    it('should prioritize derived schema properties over base properties', async function() {
      const baseSchema = new Schema('object')
        .property('status', new Schema('string').default('pending'));

      const derivedSchema = new Schema(baseSchema)
        .property('status', new Schema('string').default('active'));

      const compiled = await resolver.compile(derivedSchema);

      // Derived schema's property should win
      assert.strictEqual(compiled.properties.status.default, 'active');
    });

    it('should inherit options from Schema base', async function() {
      const baseSchema = new Schema('string')
        .required(true);

      const derivedSchema = new Schema(baseSchema)
        .default('default-value');

      const compiled = await resolver.compile(derivedSchema);

      // Should have both required from base and default from derived
      assert.strictEqual(compiled.required, true);
      assert.strictEqual(compiled.default, 'default-value');
    });

    it('should prioritize derived options over base options', async function() {
      const baseSchema = new Schema('string')
        .required(true)
        .default('base-default');

      const derivedSchema = new Schema(baseSchema)
        .required(false)
        .default('derived-default');

      const compiled = await resolver.compile(derivedSchema);

      // Derived schema's options should win
      assert.strictEqual(compiled.required, false);
      assert.strictEqual(compiled.default, 'derived-default');
    });
  });

  describe('Multi-level inheritance chains', function() {

    it('should resolve through multiple Schema layers', async function() {
      const level1 = new Schema('number')
        .meta('level', 1);

      const level2 = new Schema(level1)
        .meta('level', 2)
        .meta('layer2', true);

      const level3 = new Schema(level2)
        .meta('level', 3)
        .meta('layer3', true);

      const compiled = await resolver.compile(level3);

      // Should resolve to number base type
      assert.strictEqual(await compiled.normalize('42'), 42);

      // Local metadata should win
      assert.strictEqual(compiled.metadata.level, 3);
      // Should have metadata from all layers
      assert.strictEqual(compiled.metadata.layer2, true);
      assert.strictEqual(compiled.metadata.layer3, true);
    });

    it('should follow precedence rules through chain', async function() {
      const base = new Schema('string')
        .option('opt1', 'base')
        .option('opt2', 'base')
        .option('opt3', 'base');

      const middle = new Schema(base)
        .option('opt2', 'middle')
        .option('opt3', 'middle');

      const top = new Schema(middle)
        .option('opt3', 'top');

      const compiled = await resolver.compile(top);

      // Each level should override previous levels
      assert.strictEqual(compiled.options.opt1, 'base');
      assert.strictEqual(compiled.options.opt2, 'middle');
      assert.strictEqual(compiled.options.opt3, 'top');
    });

    it('should accumulate properties through chain', async function() {
      const base = new Schema('object')
        .property('a', new Schema('string'));

      const middle = new Schema(base)
        .property('b', new Schema('number'));

      const top = new Schema(middle)
        .property('c', new Schema('boolean'));

      const compiled = await resolver.compile(top);

      // Should have properties from all levels
      assert.ok(compiled.properties.a);
      assert.ok(compiled.properties.b);
      assert.ok(compiled.properties.c);
    });
  });

  describe('Inheriting custom base types', function() {

    it('should inherit from custom registered base type', async function() {
      const emailSchema = new Schema('string')
        .normalizer((v) => String(v).toLowerCase().trim())
        .validator((v) => {
          if (!v.includes('@')) throw new Error('Invalid email');
          return v;
        });

      resolver.registerSchema('email', emailSchema);

      const schema = new Schema('email');
      const compiled = await resolver.compile(schema);

      // Should inherit email normalizer
      assert.strictEqual(await compiled.normalize('  TEST@EXAMPLE.COM  '), 'test@example.com');
    });

    it('should extend custom base type with additional constraints', async function() {
      const positiveNumberSchema = new Schema('number')
        .validator((v) => {
          if (v <= 0) throw new Error('Must be positive');
          return v;
        });

      resolver.registerSchema('positive', positiveNumberSchema);

      const schema = new Schema('positive')
        .meta('description', 'A positive integer')
        .default(1);

      const compiled = await resolver.compile(schema);

      // Should have both number normalizer and positive validator
      assert.strictEqual(await compiled.normalize('42'), 42);
      assert.strictEqual(compiled.default, 1);
    });
  });

  describe('Inheritance with values', function() {

    it('should inherit base type but add values constraint', async function() {
      const schema = new Schema('string')
        .values(['red', 'green', 'blue']);

      const compiled = await resolver.compile(schema);

      // Should have string normalizer from base
      assert.strictEqual(await compiled.normalize(123), '123');
      // Should have values from schema
      assert.deepStrictEqual(compiled.values, ['red', 'green', 'blue']);
    });

    it('should inherit values from base Schema', async function() {
      const baseSchema = new Schema('string')
        .values(['option1', 'option2']);

      const derivedSchema = new Schema(baseSchema);

      const compiled = await resolver.compile(derivedSchema);

      assert.deepStrictEqual(compiled.values, ['option1', 'option2']);
    });

    it('should accumulate values from both base and derived schemas', async function() {
      const baseSchema = new Schema('string')
        .values(['a', 'b']);

      const derivedSchema = new Schema(baseSchema)
        .values(['x', 'y']);

      const compiled = await resolver.compile(derivedSchema);

      // Values are accumulated from both
      assert.deepStrictEqual(compiled.values, ['a', 'b', 'x', 'y']);
    });
  });

  describe('Inheritance with defaults', function() {

    it('should inherit default from base Schema', async function() {
      const baseSchema = new Schema('string')
        .default('base-default');

      const derivedSchema = new Schema(baseSchema);

      const compiled = await resolver.compile(derivedSchema);

      assert.strictEqual(compiled.default, 'base-default');
    });

    it('should override base default with derived default', async function() {
      const baseSchema = new Schema('number')
        .default(0);

      const derivedSchema = new Schema(baseSchema)
        .default(42);

      const compiled = await resolver.compile(derivedSchema);

      assert.strictEqual(compiled.default, 42);
    });
  });

  describe('Inheritance precedence summary', function() {

    it('should follow precedence: local > schema base > type base', async function() {
      const typeBase = resolver.getSchema('string'); // has String() normalizer

      const schemaBase = new Schema('string')
        .meta('source', 'schema-base')
        .option('baseOption', 'from-schema');

      const local = new Schema(schemaBase)
        .meta('source', 'local')
        .option('localOption', 'from-local')
        .normalizer((v) => `local:${v}`);

      const compiled = await resolver.compile(local);

      // Local metadata wins
      assert.strictEqual(compiled.metadata.source, 'local');
      // Has both options
      assert.strictEqual(compiled.options.baseOption, 'from-schema');
      assert.strictEqual(compiled.options.localOption, 'from-local');
      // Local normalizer wins
      assert.strictEqual(await compiled.normalize('test'), 'local:test');
    });

    it('should demonstrate full inheritance chain', async function() {
      // Type base: string (has String() normalizer)

      // Schema base layer 1
      const layer1 = new Schema('string')
        .meta('layer', 1)
        .meta('permanent', 'never-overridden')
        .option('opt1', 'layer1');

      // Schema base layer 2
      const layer2 = new Schema(layer1)
        .meta('layer', 2)
        .option('opt1', 'layer2')
        .option('opt2', 'layer2');

      // Local schema
      const local = new Schema(layer2)
        .meta('layer', 'local')
        .option('opt1', 'local')
        .option('opt3', 'local');

      const compiled = await resolver.compile(local);

      // Type base provides normalizer (not overridden)
      assert.strictEqual(await compiled.normalize(42), '42');

      // Local metadata wins
      assert.strictEqual(compiled.metadata.layer, 'local');
      // But inherited metadata is preserved
      assert.strictEqual(compiled.metadata.permanent, 'never-overridden');

      // Options follow precedence
      assert.strictEqual(compiled.options.opt1, 'local'); // local wins
      assert.strictEqual(compiled.options.opt2, 'layer2'); // from layer2
      assert.strictEqual(compiled.options.opt3, 'local'); // local only
    });
  });
});
