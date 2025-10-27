
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, NormalizeError } from '../src/errors.js';

describe('Schema Compilation - String Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('String normalization', function() {

    it('should normalize string values to strings', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('hello'), 'hello');
      assert.strictEqual(compiled.normalize(''), '');
    });

    it('should normalize numbers to strings', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(123), '123');
      assert.strictEqual(compiled.normalize(0), '0');
      assert.strictEqual(compiled.normalize(-42), '-42');
      assert.strictEqual(compiled.normalize(3.14), '3.14');
    });

    it('should normalize booleans to strings', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(true), 'true');
      assert.strictEqual(compiled.normalize(false), 'false');
    });

    it('should normalize null to string', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(null), 'null');
    });

    it('should normalize undefined to string', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(undefined), 'undefined');
    });
  });

  describe('String transformation', function() {

    it('should transform string values unchanged', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(await compiled.transform('test', {}, 'field'), 'test');
      assert.strictEqual(await compiled.transform('', {}, 'field'), '');
    });

    it('should use the inherited transformer from base type', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      // String base type doesn't have a custom transformer, so it should pass through
      assert.strictEqual(await compiled.transform('hello', {}, 'field'), 'hello');
    });
  });

  describe('String validation', function() {

    it('should validate string values', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const result = await compiled.validate('test');
      assert.strictEqual(result, 'test');
    });

    it('should validate empty strings', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const result = await compiled.validate('');
      assert.strictEqual(result, '');
    });

    it('should reject non-string values during validation', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate(123),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(true),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(null),
        ValidationError
      );
    });
  });

  describe('String serialization', function() {

    it('should serialize string values', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const result = await compiled.serialize('test value');
      assert.strictEqual(result, 'test value');
    });

    it('should serialize empty strings', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      const result = await compiled.serialize('');
      assert.strictEqual(result, '');
    });
  });

  describe('String with values constraint', function() {

    it('should compile string with allowed values', function() {
      const schema = new Schema('string')
        .values(['red', 'green', 'blue']);

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, ['red', 'green', 'blue']);
    });

    it('should normalize and validate matching values', async function() {
      const schema = new Schema('string')
        .values(['active', 'inactive']);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('active'), 'active');
      const validated = await compiled.validate('active');
      assert.strictEqual(validated, 'active');
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('string')
        .values(['yes', 'no']);

      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform('maybe', {}, 'field'),
        ValidationError
      );
    });

    it('should normalize numeric values to strings in values list', function() {
      const schema = new Schema('string')
        .values([1, 2, 3]);

      const compiled = resolver.compile(schema);

      // Values should be normalized to strings during compilation
      assert.deepStrictEqual(compiled.values, ['1', '2', '3']);
    });
  });

  describe('String with default value', function() {

    it('should have default value in compiled schema', function() {
      const schema = new Schema('string')
        .default('default-value');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.default, 'default-value');
    });

    it('should validate with default value', async function() {
      const schema = new Schema('string')
        .default('hello');

      const compiled = resolver.compile(schema);

      // The default itself should be a valid string
      const validated = await compiled.validate('hello');
      assert.strictEqual(validated, 'hello');
    });
  });

  describe('String with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('string')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should compile with required false', function() {
      const schema = new Schema('string')
        .required(false);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, false);
    });
  });

  describe('String metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('string')
        .meta('description', 'A test string')
        .meta('example', 'hello world');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'A test string');
      assert.strictEqual(compiled.metadata.example, 'hello world');
    });

    it('should have valueName set from base type', function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'string');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow', async function() {
      const schema = new Schema('string');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize(123);
      assert.strictEqual(normalized, '123');

      // Transform
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.strictEqual(transformed, '123');

      // Validate
      const validated = await compiled.validate(transformed);
      assert.strictEqual(validated, '123');
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('string')
        .values(['small', 'medium', 'large']);

      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('medium');
      assert.strictEqual(normalized, 'medium');

      // Transform (should check against values)
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.strictEqual(transformed, 'medium');

      // Validate
      const validated = await compiled.validate(transformed);
      assert.strictEqual(validated, 'medium');
    });
  });
});
