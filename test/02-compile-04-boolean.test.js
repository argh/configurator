
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Schema Compilation - Boolean Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Boolean normalization', function() {

    it('should normalize boolean values unchanged', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(true), true);
      assert.strictEqual(compiled.normalize(false), false);
    });

    it('should normalize string "true" to boolean true', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('true'), true);
      assert.strictEqual(compiled.normalize('True'), true);
      assert.strictEqual(compiled.normalize('TRUE'), true);
    });

    it('should normalize string "false" to boolean false', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('false'), false);
      assert.strictEqual(compiled.normalize('False'), false);
      assert.strictEqual(compiled.normalize('FALSE'), false);
    });

    it('should normalize "1" to true', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('1'), true);
    });

    it('should normalize "0" to false', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('0'), false);
    });

    it('should normalize "yes" to true', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('yes'), true);
      assert.strictEqual(compiled.normalize('Yes'), true);
      assert.strictEqual(compiled.normalize('YES'), true);
    });

    it('should normalize "no" to false', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('no'), false);
      assert.strictEqual(compiled.normalize('No'), false);
      assert.strictEqual(compiled.normalize('NO'), false);
    });

    it('should normalize number 1 to true', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(1), true);
    });

    it('should normalize number 0 to false', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(0), false);
    });

    it('should normalize truthy values to true using Boolean()', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize('any-string'), true);
      assert.strictEqual(compiled.normalize(42), true);
      assert.strictEqual(compiled.normalize([]), true);
      assert.strictEqual(compiled.normalize({}), true);
    });

    it('should normalize falsy values to false using Boolean()', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(null), false);
      assert.strictEqual(compiled.normalize(undefined), false);
      assert.strictEqual(compiled.normalize(''), false);
    });
  });

  describe('Boolean transformation', function() {

    it('should transform boolean values unchanged', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(await compiled.transform(true, {}, 'field'), true);
      assert.strictEqual(await compiled.transform(false, {}, 'field'), false);
    });
  });

  describe('Boolean validation', function() {

    it('should validate true', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(await compiled.validate(true), true);
    });

    it('should validate false', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(await compiled.validate(false), false);
    });

    it('should reject non-boolean values during validation', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('true'),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(1),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(0),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(null),
        ValidationError
      );
    });
  });

  describe('Boolean serialization', function() {

    it('should serialize boolean values', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(await compiled.serialize(true), true);
      assert.strictEqual(await compiled.serialize(false), false);
    });
  });

  describe('Boolean with values constraint', function() {

    it('should compile boolean with allowed values', function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [true]);
    });

    it('should compile with both true and false values', function() {
      const schema = new Schema('boolean')
        .values([true, false]);

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.values, [true, false]);
    });

    it('should normalize string values to booleans in values list', function() {
      const schema = new Schema('boolean')
        .values(['true', 'false']);

      const compiled = resolver.compile(schema);

      // Values should be normalized to booleans during compilation
      assert.deepStrictEqual(compiled.values, [true, false]);
    });

    it('should normalize and validate matching values', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.normalize(true), true);
      const validated = await compiled.validate(true);
      assert.strictEqual(validated, true);
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform(false, {}, 'field'),
        ValidationError
      );
    });
  });

  describe('Boolean with default value', function() {

    it('should have default value true', function() {
      const schema = new Schema('boolean')
        .default(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.default, true);
    });

    it('should have default value false', function() {
      const schema = new Schema('boolean')
        .default(false);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.default, false);
    });

    it('should validate with default value', async function() {
      const schema = new Schema('boolean')
        .default(true);

      const compiled = resolver.compile(schema);

      const validated = await compiled.validate(true);
      assert.strictEqual(validated, true);
    });
  });

  describe('Boolean with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('boolean')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should compile with required false', function() {
      const schema = new Schema('boolean')
        .required(false);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, false);
    });

    it('should have valueDescription with angle brackets when required', function() {
      const schema = new Schema('boolean')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<true|false>');
    });
  });

  describe('Boolean metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('boolean')
        .meta('description', 'Enable debug mode')
        .meta('flagHint', 'D');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Enable debug mode');
      assert.strictEqual(compiled.metadata.flagHint, 'D');
    });

    it('should have valueName set from base type', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'boolean');
    });

    it('should have valueDescription set from base type', function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[true|false]');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow with string input', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('true');
      assert.strictEqual(normalized, true);

      // Transform
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.strictEqual(validated, true);
    });

    it('should handle normalize -> transform -> validate workflow with "yes"', async function() {
      const schema = new Schema('boolean');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('yes');
      assert.strictEqual(normalized, true);

      // Transform
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.strictEqual(validated, true);
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('1');
      assert.strictEqual(normalized, true);

      // Transform (should check against values)
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.strictEqual(transformed, true);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.strictEqual(validated, true);
    });

    it('should reject false when only true is allowed', async function() {
      const schema = new Schema('boolean')
        .values([true]);

      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('no');
      assert.strictEqual(normalized, false);

      // Transform should fail due to values constraint
      await assert.rejects(
        () => compiled.transform(normalized, {}, 'field'),
        ValidationError
      );
    });
  });
});