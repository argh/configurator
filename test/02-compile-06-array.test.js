
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ConstraintError, NormalizeError, TransformError, ValidationError } from '../src/schema/schema-errors.js';

describe('Schema Compilation - Array Type', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Array normalization', function() {

    it('should normalize array values unchanged', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = [1, 2, 3];
      const normalized = await compiled.normalizeValue(arr);
      assert.deepStrictEqual(normalized, arr);
    });

    it('should normalize empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = [];
      const normalized = await compiled.normalizeValue(arr);
      assert.deepStrictEqual(normalized, arr);
    });

    it('should normalize true to empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue(true);
      assert.deepStrictEqual(normalized, []);
    });

    it('should normalize JSON array string to array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('[1,2,3]');
      assert.deepStrictEqual(normalized, [1, 2, 3]);
    });

    it('should normalize JSON array string with strings', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('["a","b","c"]');
      assert.deepStrictEqual(normalized, ['a', 'b', 'c']);
    });

    it('should normalize comma-separated string to array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('apple,banana,cherry');
      assert.deepStrictEqual(normalized, ['apple', 'banana', 'cherry']);
    });

    it('should normalize comma-separated string with spaces', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('one, two, three');
      assert.deepStrictEqual(normalized, ['one', 'two', 'three']);
    });

    it('should filter out empty strings from comma-separated values', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('a,,b,,c');
      assert.deepStrictEqual(normalized, ['a', 'b', 'c']);
    });

    it('should normalize empty string to empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('');
      assert.deepStrictEqual(normalized, []);
    });

    it('should normalize whitespace-only string to empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('   ');
      assert.deepStrictEqual(normalized, []);
    });

    it('should throw NormalizeError for invalid JSON array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
      async () => await compiled.normalizeValue('[invalid-json]'), NormalizeError);
    });

    it('should throw NormalizeError for non-array values', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
      async () => await compiled.normalizeValue(123), NormalizeError);
      await assert.rejects(
      async () => await compiled.normalizeValue(false), NormalizeError);
      await assert.rejects(
      async () => await compiled.normalizeValue({ a: 1 }), NormalizeError);
    });

    it('should normalize array to string when values constraint exists', async function() {
      const schema = new Schema('array')
        .values([[1, 2]]);

      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue([1, 2]);
      assert.deepStrictEqual(normalized, [1,2]);
    });
  });

  describe('Array validation', function() {

    it('should validate array values', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = [1, 2, 3];
      const validated = await compiled.validateValue(arr);
      assert.deepStrictEqual(validated, arr);
    });

    it('should validate empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const validated = await compiled.validateValue([]);
      assert.deepStrictEqual(validated, []);
    });

    it('should validate array with mixed types', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = [1, 'two', true, null];
      const validated = await compiled.validateValue(arr);
      assert.deepStrictEqual(validated, arr);
    });

    it('should reject non-array values during validation', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('string'),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validateValue(123),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validateValue(true),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validateValue({ length: 3 }),
        ValidationError
      );
    });
    it('should not reject null array validation', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(await compiled.validateValue(null), null);
    });
  });

  describe('Array serialization', function() {

    it('should serialize array values', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = [10, 20, 30];
      const serialized = await compiled.serializeValue(arr);
      assert.deepStrictEqual(serialized, arr);
    });

    it('should serialize empty array', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const serialized = await compiled.serializeValue([]);
      assert.deepStrictEqual(serialized, []);
    });

    it('should serialize array with mixed types', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      const arr = ['a', 1, true];
      const serialized = await compiled.serializeValue(arr);
      assert.deepStrictEqual(serialized, arr);
    });
  });

  describe('Array with values constraint', function() {

    it('should compile array with allowed values', async function() {
      const schema = new Schema('array')
        .values([[1, 2], [3, 4]]);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.values.length, 2);
      assert.deepStrictEqual(compiled.values[0], [1,2]);
      assert.deepStrictEqual(compiled.values[1], [3,4]);
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('array')
        .values([['a', 'b']]);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.transformValue(['x', 'y']),
        TransformError
      );
    });
  });

  describe('Array with element schema', function() {

    it('should compile array with wildcard element schema', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties['*']);
      assert.strictEqual(compiled.hasChildren, true);
      assert.strictEqual(compiled.isArray, true);
    });

    it('should validate array with typed elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const arr = [1, 2, 3];
      const validated = await compiled.validateValue(arr);
      assert.deepStrictEqual(validated, arr);
    });
  });

  describe('Array with indexed properties', function() {

    it('should compile array with specific index schemas', async function() {
      const schema = new Schema('array')
        .property('0', new Schema('string'))
        .property('1', new Schema('number'));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties['0']);
      assert.ok(compiled.properties['1']);
    });
  });

  describe('Array with default value', function() {

    it('should have default value in compiled schema', async function() {
      const schema = new Schema('array')
        .default([1, 2, 3]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, [1, 2, 3]);
    });

    it('should have empty array as default', async function() {
      const schema = new Schema('array')
        .default([]);

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, []);
    });
  });

  describe('Array with required option', function() {

    it('should compile with required flag', async function() {
      const schema = new Schema('array')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should have valueDescription with angle brackets when required', async function() {
      const schema = new Schema('array')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<...>');
    });
  });

  describe('Array metadata', function() {

    it('should preserve stringified metadata during compilation', async function() {
      const schema = new Schema('array')
        .meta('description', 'List of items')
        .meta('minLength', 1)
        .meta('maxLength', 10);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'List of items');
      assert.strictEqual(compiled.metadata.minLength, '1');
      assert.strictEqual(compiled.metadata.maxLength, '10');
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'array');
    });

    it('should have valueDescription set from base type', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[...]');
    });
  });

});
