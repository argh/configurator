
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ConstraintError, NormalizeError, TransformError, ValidationError } from '../src/schema/schema-errors.js';

describe('Schema Compilation - String Type', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('String normalization', function() {

    it('should normalize string values to strings', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue('hello'), 'hello');
      assert.strictEqual(await compiled.normalizeValue(''), '');
    });

    it('should normalize numbers to strings', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue(123), '123');
      assert.strictEqual(await compiled.normalizeValue(0), '0');
      assert.strictEqual(await compiled.normalizeValue(-42), '-42');
      assert.strictEqual(await compiled.normalizeValue(3.14), '3.14');
    });

    it('should normalize booleans to strings', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue(true), 'true');
      assert.strictEqual(await compiled.normalizeValue(false), 'false');
    });

    it('should normalize null to null', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue(null), null);
    });

    it('should normalize undefined to undefined', async function() {
      // fixme - not sure this is a valid test
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue(undefined), undefined);
    });
  });

  describe('String validation', function() {

    it('should validate string values', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('test');
      assert.strictEqual(result, 'test');
    });

    it('should validate empty strings', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('');
      assert.strictEqual(result, '');
    });

    it('should ignore null and undefined during validation', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      let result = await compiled.validateValue(null);
      assert.strictEqual(result, null);

      result = await compiled.validateValue(undefined);
      assert.strictEqual(result, undefined);
    });


    it('should reject non-string values during validation', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue(123),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validateValue(true),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validateValue({}),
        ValidationError
      );
    });
  });

  describe('String serialization', function() {

    it('should serialize string values', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.serializeValue('test value');
      assert.strictEqual(result, 'test value');
    });

    it('should serialize empty strings', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.serializeValue('');
      assert.strictEqual(result, '');
    });
  });

  describe('String with values constraint', function() {

    it('should compile string with allowed values', async function() {
      const schema = new Schema('string')
        .values(['red', 'green', 'blue']);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, ['red', 'green', 'blue']);
    });

    it('should normalize and validate matching values', async function() {
      const schema = new Schema('string')
        .values(['active', 'inactive']);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.normalizeValue('active'), 'active');
      const validated = await compiled.validateValue('active');
      assert.strictEqual(validated, 'active');
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('string')
        .values(['yes', 'no']);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.transformValue('maybe'),
        TransformError
      );
    });

    it('should normalize numeric values to strings in values list', async function() {
      const schema = new Schema('string')
        .values([1, 2, 3]);

      const compiled = await resolver.compile(schema);

      // Values should be normalized to strings during compilation
      assert.deepStrictEqual(compiled.values, ['1', '2', '3']);
    });
  });

  describe('String with default value', function() {

    it('should have default value in compiled schema', async function() {
      const schema = new Schema('string')
        .default('default-value');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, 'default-value');
    });

    it('should validate with default value', async function() {
      const schema = new Schema('string')
        .default('hello');

      const compiled = await resolver.compile(schema);

      // The default itself should be a valid string
      const validated = await compiled.validateValue('hello');
      assert.strictEqual(validated, 'hello');
    });
  });

  describe('String with required option', function() {

    it('should compile with required flag', async function() {
      const schema = new Schema('string')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should compile with required false', async function() {
      const schema = new Schema('string')
        .required(false);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, false);
    });

    it('should have valueDescription with angle brackets when required', async function() {
      const schema = new Schema('string')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<string>');
    });
  });

  describe('String metadata', function() {

    it('should preserve metadata during compilation', async function() {
      const schema = new Schema('string')
        .meta('description', 'A test string')
        .meta('example', 'hello world');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'A test string');
      assert.strictEqual(compiled.metadata.example, 'hello world');
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'string');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled.normalizeValue(123);
      assert.strictEqual(normalized, '123');

      // Transform
      const transformed = await compiled.transformValue(normalized);
      assert.strictEqual(transformed, '123');

      // Validate
      const validated = await compiled.validateValue(transformed);
      assert.strictEqual(validated, '123');
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('string')
        .values(['small', 'medium', 'large']);

      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled.normalizeValue('medium');
      assert.strictEqual(normalized, 'medium');

      // Transform (should check against values)
      const transformed = await compiled.transformValue(normalized);
      assert.strictEqual(transformed, 'medium');

      // Validate
      const validated = await compiled.validateValue(transformed);
      assert.strictEqual(validated, 'medium');
    });
  });
});
