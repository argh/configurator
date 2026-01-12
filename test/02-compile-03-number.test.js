
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, NormalizeError, ConstraintError, TransformError } from '../src/errors.js';

describe('Schema Compilation - Number Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Number normalization', function() {

    it('should normalize number values unchanged', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(42), 42);
      assert.strictEqual(await compiled._normalizeValue(0), 0);
      assert.strictEqual(await compiled._normalizeValue(-10), -10);
      assert.strictEqual(await compiled._normalizeValue(3.14), 3.14);
    });

    it('should normalize numeric strings to numbers', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('123'), 123);
      assert.strictEqual(await compiled._normalizeValue('0'), 0);
      assert.strictEqual(await compiled._normalizeValue('-42'), -42);
      assert.strictEqual(await compiled._normalizeValue('3.14159'), 3.14159);
    });

    it('should normalize string zero variations', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('0'), 0);
      assert.strictEqual(await compiled._normalizeValue('0.0'), 0);
      assert.strictEqual(await compiled._normalizeValue('-0'), -0);
    });

    it('should throw NormalizeError for invalid number strings', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
      async () => await compiled._normalizeValue('not-a-number'), NormalizeError);
      await assert.rejects(
      async () => await compiled._normalizeValue('12.34.56'), NormalizeError);
      await assert.rejects(
      async () => await compiled._normalizeValue('abc'), NormalizeError);
    });

    it('should handle NaN by converting to NaN', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      // NaN normalizes to NaN (it's a number type)
      const result = await compiled._normalizeValue(NaN);
      assert.ok(Number.isNaN(result));
    });

    it('should handle special numeric values', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(Infinity), Infinity);
      assert.strictEqual(await compiled._normalizeValue(-Infinity), -Infinity);
    });
  });

  describe('Number transformation', function() {

    it('should transform number values unchanged', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._transformValue(42), 42);
      assert.strictEqual(await compiled._transformValue(0), 0);
      assert.strictEqual(await compiled._transformValue(-100), -100);
    });

    it('should transform floating point numbers', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._transformValue(3.14), 3.14);
      assert.strictEqual(await compiled._transformValue(0.001), 0.001);
    });
  });

  describe('Number validation', function() {

    it('should validate number values', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._validateValue(42), 42);
      assert.strictEqual(await compiled._validateValue(0), 0);
      assert.strictEqual(await compiled._validateValue(-10), -10);
      assert.strictEqual(await compiled._validateValue(3.14), 3.14);
    });

    it('should validate integer values', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._validateValue(100), 100);
      assert.strictEqual(await compiled._validateValue(-50), -50);
    });

    it('should reject non-number values during validation', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._validateValue('123'),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue(true),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue({}),
        ValidationError
      );
    });

    it('should reject NaN during validation', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._validateValue(NaN),
        ValidationError
      );
    });

    it('should reject Infinity during validation', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._validateValue(Infinity),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue(-Infinity),
        ValidationError
      );
    });
  });

  describe('Number serialization', function() {

    it('should serialize number values', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.serialize(42), 42);
      assert.strictEqual(await compiled.serialize(0), 0);
      assert.strictEqual(await compiled.serialize(-10), -10);
    });

    it('should serialize floating point numbers', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.serialize(3.14159), 3.14159);
      assert.strictEqual(await compiled.serialize(0.5), 0.5);
    });
  });

  describe('Number with values constraint', function() {

    it('should compile number with allowed values', async function() {
      const schema = new Schema('number')
        .values([1, 2, 3, 4, 5]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [1, 2, 3, 4, 5]);
    });

    it('should normalize string values to numbers in values list', async function() {
      const schema = new Schema('number')
        .values(['10', '20', '30']);

      const compiled = await resolver.compile(schema);

      // Values should be normalized to numbers during compilation
      assert.deepStrictEqual(compiled.values, [10, 20, 30]);
    });

    it('should normalize and validate matching values', async function() {
      const schema = new Schema('number')
        .values([100, 200, 300]);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(200), 200);
      const validated = await compiled._validateValue(200);
      assert.strictEqual(validated, 200);
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('number')
        .values([1, 2, 3]);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._transformValue(99),
        TransformError
      );
    });

    it('should handle floating point values in values list', async function() {
      const schema = new Schema('number')
        .values([0.5, 1.0, 1.5]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [0.5, 1, 1.5]);
    });
  });

  describe('Number with default value', function() {

    it('should have default value in compiled schema', async function() {
      const schema = new Schema('number')
        .default(42);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, 42);
    });

    it('should validate with default value', async function() {
      const schema = new Schema('number')
        .default(100);

      const compiled = await resolver.compile(schema);

      const validated = await compiled._validateValue(100);
      assert.strictEqual(validated, 100);
    });

    it('should handle zero as default', async function() {
      const schema = new Schema('number')
        .default(0);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, 0);
    });

    it('should handle negative default values', async function() {
      const schema = new Schema('number')
        .default(-10);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, -10);
    });
  });

  describe('Number with required option', function() {

    it('should compile with required flag', async function() {
      const schema = new Schema('number')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should compile with required false', async function() {
      const schema = new Schema('number')
        .required(false);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, false);
    });

    it('should have valueDescription with angle brackets when required', async function() {
      const schema = new Schema('number')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<number>');
    });
  });

  describe('Number metadata', function() {

    it('should preserve metadata during compilation', async function() {
      const schema = new Schema('number')
        .meta('description', 'Port number')
        .meta('minimum', 1)
        .meta('maximum', 65535);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Port number');
      assert.strictEqual(compiled.metadata.minimum, 1);
      assert.strictEqual(compiled.metadata.maximum, 65535);
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'number');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('456');
      assert.strictEqual(normalized, 456);

      // Transform
      const transformed = await compiled._transformValue(normalized);
      assert.strictEqual(transformed, 456);

      // Validate
      const validated = await compiled._validateValue(transformed);
      assert.strictEqual(validated, 456);
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('number')
        .values([10, 20, 30]);

      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('20');
      assert.strictEqual(normalized, 20);

      // Transform (should check against values)
      const transformed = await compiled._transformValue(normalized);
      assert.strictEqual(transformed, 20);

      // Validate
      const validated = await compiled._validateValue(transformed);
      assert.strictEqual(validated, 20);
    });

    it('should reject invalid value in full workflow', async function() {
      const schema = new Schema('number')
        .values([5, 10, 15]);

      const compiled = await resolver.compile(schema);

      // Normalize should work
      const normalized = await compiled._normalizeValue('7');
      assert.strictEqual(normalized, 7);

      // Transform should fail due to values constraint
      await assert.rejects(
        () => compiled._transformValue(normalized),
        TransformError
      );
    });
  });
});
