
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ConstraintError, TransformError, ValidationError } from '../src/errors.js';

describe('Schema Compilation - Boolean Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Boolean normalization', function() {

    it('should normalize boolean values unchanged', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(true), true);
      assert.strictEqual(await compiled._normalizeValue(false), false);
    });

    it('should normalize string "true" to boolean true', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('true'), true);
      assert.strictEqual(await compiled._normalizeValue('True'), true);
      assert.strictEqual(await compiled._normalizeValue('TRUE'), true);
    });

    it('should normalize string "false" to boolean false', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('false'), false);
      assert.strictEqual(await compiled._normalizeValue('False'), false);
      assert.strictEqual(await compiled._normalizeValue('FALSE'), false);
    });

    it('should normalize "1" to true', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('1'), true);
    });

    it('should normalize "0" to false', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('0'), false);
    });

    it('should normalize "yes" to true', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('yes'), true);
      assert.strictEqual(await compiled._normalizeValue('Yes'), true);
      assert.strictEqual(await compiled._normalizeValue('YES'), true);
    });

    it('should normalize "no" to false', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('no'), false);
      assert.strictEqual(await compiled._normalizeValue('No'), false);
      assert.strictEqual(await compiled._normalizeValue('NO'), false);
    });

    it('should normalize number 1 to true', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(1), true);
    });

    it('should normalize number 0 to false', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(0), false);
    });

    it('should normalize truthy values to true using Boolean()', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue('any-string'), true);
      assert.strictEqual(await compiled._normalizeValue(42), true);
      assert.strictEqual(await compiled._normalizeValue([]), true);
      assert.strictEqual(await compiled._normalizeValue({}), true);
    });

    it('should normalize falsy values to false using Boolean()', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

//      assert.strictEqual(await compiled.normalizeValue(null), false);
//      assert.strictEqual(await compiled.normalize(undefined), false);
      assert.strictEqual(await compiled._normalizeValue(''), false);
    });
  });

  describe('Boolean transformation', function() {

    it('should transform boolean values unchanged', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._transformValue(true), true);
      assert.strictEqual(await compiled._transformValue(false), false);
    });
  });

  describe('Boolean validation', function() {

    it('should validate true', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._validateValue(true), true);
    });

    it('should validate false', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._validateValue(false), false);
    });

    it('should reject non-boolean values during validation', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._validateValue('true'),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue(1),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue(0),
        ValidationError
      );

      await assert.rejects(
        () => compiled._validateValue({}),
        ValidationError
      );
    });
  });

  describe('Boolean serialization', function() {

    it('should serialize boolean values', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.serialize(true), true);
      assert.strictEqual(await compiled.serialize(false), false);
    });
  });

  describe('Boolean with values constraint', function() {

    it('should compile boolean with allowed values', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [true]);
    });

    it('should compile with both true and false values', async function() {
      const schema = new Schema('boolean')
        .values([true, false]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [true, false]);
    });

    it('should normalize string values to booleans in values list', async function() {
      const schema = new Schema('boolean')
        .values(['true', 'false']);

      const compiled = await resolver.compile(schema);

      // Values should be normalized to booleans during compilation
      assert.deepStrictEqual(compiled.values, [true, false]);
    });

    it('should normalize and validate matching values', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled._normalizeValue(true), true);
      const validated = await compiled._validateValue(true);
      assert.strictEqual(validated, true);
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled._transformValue(false),
        TransformError
      );
    });
  });

  describe('Boolean with default value', function() {

    it('should have default value true', async function() {
      const schema = new Schema('boolean')
        .default(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, true);
    });

    it('should have default value false', async function() {
      const schema = new Schema('boolean')
        .default(false);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.default, false);
    });

    it('should validate with default value', async function() {
      const schema = new Schema('boolean')
        .default(true);

      const compiled = await resolver.compile(schema);

      const validated = await compiled._validateValue(true);
      assert.strictEqual(validated, true);
    });
  });

  describe('Boolean with required option', function() {

    it('should compile with required flag', async function() {
      const schema = new Schema('boolean')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should compile with required false', async function() {
      const schema = new Schema('boolean')
        .required(false);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, false);
    });

    it('should have valueDescription with angle brackets when required', async function() {
      const schema = new Schema('boolean')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<true|false>');
    });
  });

  describe('Boolean metadata', function() {

    it('should preserve metadata during compilation', async function() {
      const schema = new Schema('boolean')
        .meta('description', 'Enable debug mode')
        .meta('flagHint', 'D');

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Enable debug mode');
      assert.strictEqual(compiled.metadata.flagHint, 'D');
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'boolean');
    });

    it('should have valueDescription set from base type', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[true|false]');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow with string input', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('true');
      assert.strictEqual(normalized, true);

      // Transform
      const transformed = await compiled._transformValue(normalized);
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled._validateValue(transformed);
      assert.strictEqual(validated, true);
    });

    it('should handle normalize -> transform -> validate workflow with "yes"', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('yes');
      assert.strictEqual(normalized, true);

      // Transform
      const transformed = await compiled._transformValue(normalized);
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled._validateValue(transformed);
      assert.strictEqual(validated, true);
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('1');
      assert.strictEqual(normalized, true);

      // Transform (should check against values)
      const transformed = await compiled._transformValue(normalized);
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled._validateValue(transformed);
      assert.strictEqual(validated, true);
    });

    it('should reject false when only true is allowed', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled._normalizeValue('no');
      assert.strictEqual(normalized, false);

      // Transform should fail due to values constraint
      await assert.rejects(
        () => compiled._transformValue(normalized),
        TransformError
      );
    });
  });
});