
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, NormalizeError, TransformError } from '../src/errors.js';

describe('Schema Compilation - Array Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Array normalization', function() {

    it('should normalize array values unchanged', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [1, 2, 3];
      const normalized = compiled.normalize(arr);
      assert.deepStrictEqual(normalized, arr);
    });

    it('should normalize empty array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [];
      const normalized = compiled.normalize(arr);
      assert.deepStrictEqual(normalized, arr);
    });

    it('should normalize true to empty array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize(true);
      assert.deepStrictEqual(normalized, []);
    });

    it('should normalize JSON array string to array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('[1,2,3]');
      assert.deepStrictEqual(normalized, [1, 2, 3]);
    });

    it('should normalize JSON array string with strings', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('["a","b","c"]');
      assert.deepStrictEqual(normalized, ['a', 'b', 'c']);
    });

    it('should normalize comma-separated string to array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('apple,banana,cherry');
      assert.deepStrictEqual(normalized, ['apple', 'banana', 'cherry']);
    });

    it('should normalize comma-separated string with spaces', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('one, two, three');
      assert.deepStrictEqual(normalized, ['one', 'two', 'three']);
    });

    it('should filter out empty strings from comma-separated values', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('a,,b,,c');
      assert.deepStrictEqual(normalized, ['a', 'b', 'c']);
    });

    it('should normalize empty string to empty array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('');
      assert.deepStrictEqual(normalized, []);
    });

    it('should normalize whitespace-only string to empty array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('   ');
      assert.deepStrictEqual(normalized, []);
    });

    it('should throw NormalizeError for invalid JSON array', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      assert.throws(() => compiled.normalize('[invalid-json]'), NormalizeError);
    });

    it('should throw NormalizeError for non-array values', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      assert.throws(() => compiled.normalize(123), NormalizeError);
      assert.throws(() => compiled.normalize(false), NormalizeError);
      assert.throws(() => compiled.normalize({ a: 1 }), NormalizeError);
    });

    it('should normalize array to string when values constraint exists', function() {
      const schema = new Schema('array')
        .values([[1, 2]]);

      const compiled = resolver.compile(schema);

      // When values exist, normalization should stringify for comparison
      const normalized = compiled.normalize([1, 2]);
      assert.strictEqual(typeof normalized, 'string');
      assert.strictEqual(normalized, '[1,2]');
    });
  });

  describe('Array transformation', function() {

    it('should transform array values unchanged', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [1, 2, 3];
      const transformed = await compiled.transform(arr, {}, 'field');
      assert.deepStrictEqual(transformed, arr);
    });

    it('should transform empty array', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform([], {}, 'field');
      assert.deepStrictEqual(transformed, []);
    });

    it('should transform true to empty array', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform(true, {}, 'field');
      assert.deepStrictEqual(transformed, []);
    });

    it('should transform JSON string to array', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('[10,20,30]', {}, 'field');
      assert.deepStrictEqual(transformed, [10, 20, 30]);
    });

    it('should transform JSON string with whitespace', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('  ["x","y","z"]  ', {}, 'field');
      assert.deepStrictEqual(transformed, ['x', 'y', 'z']);
    });

    it('should throw TransformError for invalid JSON string', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform('[not-valid-json]', {}, 'field'),
        TransformError
      );
    });

    it('should throw TransformError for non-array values', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform(123, {}, 'field'),
        TransformError
      );

      await assert.rejects(
        () => compiled.transform({ a: 1 }, {}, 'field'),
        TransformError
      );
    });
  });

  describe('Array validation', function() {

    it('should validate array values', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [1, 2, 3];
      const validated = await compiled.validate(arr);
      assert.deepStrictEqual(validated, arr);
    });

    it('should validate empty array', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const validated = await compiled.validate([]);
      assert.deepStrictEqual(validated, []);
    });

    it('should validate array with mixed types', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [1, 'two', true, null];
      const validated = await compiled.validate(arr);
      assert.deepStrictEqual(validated, arr);
    });

    it('should reject non-array values during validation', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('string'),
        ValidationError
      );

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

      await assert.rejects(
        () => compiled.validate({ length: 3 }),
        ValidationError
      );
    });
  });

  describe('Array serialization', function() {

    it('should serialize array values', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = [10, 20, 30];
      const serialized = await compiled.serialize(arr);
      assert.deepStrictEqual(serialized, arr);
    });

    it('should serialize empty array', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const serialized = await compiled.serialize([]);
      assert.deepStrictEqual(serialized, []);
    });

    it('should serialize array with mixed types', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      const arr = ['a', 1, true];
      const serialized = await compiled.serialize(arr);
      assert.deepStrictEqual(serialized, arr);
    });
  });

  describe('Array with values constraint', function() {

    it('should compile array with allowed values', function() {
      const schema = new Schema('array')
        .values([[1, 2], [3, 4]]);

      const compiled = resolver.compile(schema);

      // Values should be stringified for comparison
      assert.strictEqual(compiled.values.length, 2);
      assert.strictEqual(compiled.values[0], '[1,2]');
      assert.strictEqual(compiled.values[1], '[3,4]');
    });

    it('should normalize and check matching values', function() {
      const schema = new Schema('array')
        .values([[1, 2, 3]]);

      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize([1, 2, 3]);
      assert.strictEqual(normalized, '[1,2,3]');
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('array')
        .values([['a', 'b']]);

      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform(['x', 'y'], {}, 'field'),
        ValidationError
      );
    });
  });

  describe('Array with element schema', function() {

    it('should compile array with wildcard element schema', function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties['*']);
      assert.strictEqual(compiled.hasChildren, true);
      assert.strictEqual(compiled.isArray, true);
    });

    it('should validate array with typed elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = resolver.compile(schema);

      const arr = [1, 2, 3];
      const validated = await compiled.validate(arr);
      assert.deepStrictEqual(validated, arr);
    });
  });

  describe('Array with indexed properties', function() {

    it('should compile array with specific index schemas', function() {
      const schema = new Schema('array')
        .property('0', new Schema('string'))
        .property('1', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties['0']);
      assert.ok(compiled.properties['1']);
    });
  });

  describe('Array with default value', function() {

    it('should have default value in compiled schema', function() {
      const schema = new Schema('array')
        .default([1, 2, 3]);

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, [1, 2, 3]);
    });

    it('should have empty array as default', function() {
      const schema = new Schema('array')
        .default([]);

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, []);
    });
  });

  describe('Array with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('array')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should have valueDescription with angle brackets when required', function() {
      const schema = new Schema('array')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<...>');
    });
  });

  describe('Array metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('array')
        .meta('description', 'List of items')
        .meta('minLength', 1)
        .meta('maxLength', 10);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'List of items');
      assert.strictEqual(compiled.metadata.minLength, 1);
      assert.strictEqual(compiled.metadata.maxLength, 10);
    });

    it('should have valueName set from base type', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'array');
    });

    it('should have valueDescription set from base type', function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[...]');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow with JSON', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('[1,2,3]');
      assert.deepStrictEqual(normalized, [1, 2, 3]);

      // Transform
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.deepStrictEqual(transformed, [1, 2, 3]);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, [1, 2, 3]);
    });

    it('should handle workflow with comma-separated string', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('red,green,blue');
      assert.deepStrictEqual(normalized, ['red', 'green', 'blue']);

      // Transform (needs JSON format for transformer)
      const transformed = await compiled.transform(['red', 'green', 'blue'], {}, 'field');
      assert.deepStrictEqual(transformed, ['red', 'green', 'blue']);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, ['red', 'green', 'blue']);
    });

    it('should handle workflow with true input', async function() {
      const schema = new Schema('array');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize(true);
      assert.deepStrictEqual(normalized, []);

      // Transform
      const transformed = await compiled.transform(true, {}, 'field');
      assert.deepStrictEqual(transformed, []);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, []);
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('array')
        .values([[10, 20]]);

      const compiled = resolver.compile(schema);

      // Normalize (should stringify for comparison)
      const normalized = compiled.normalize([10, 20]);
      assert.strictEqual(normalized, '[10,20]');

      // Transform from string (normalized form) back to array
      const transformed = await compiled.transform('[10,20]', {}, 'field');
      assert.deepStrictEqual(transformed, [10, 20]);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, [10, 20]);
    });
  });
});
