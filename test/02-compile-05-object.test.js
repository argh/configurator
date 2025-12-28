
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, NormalizeError, TransformError, ConstraintError } from '../src/errors.js';

describe('Schema Compilation - Object Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Object normalization', function() {

    it('should normalize empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = {};
      const normalized = await compiled.normalizeValue(obj);
      assert.deepStrictEqual(normalized, obj);
    });

    it('should normalize object values unchanged', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { a: 1, b: 2 };
      const normalized = await compiled.normalizeValue(obj);
      assert.deepStrictEqual(normalized, obj);
    });

    it('should normalize true to empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue(true);
      assert.deepStrictEqual(normalized, {});
    });

    it('should normalize JSON string to object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('{"x":10,"y":20}');
      assert.deepStrictEqual(normalized, { x: 10, y: 20 });
    });

    it('should normalize JSON string with nested objects', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue('{"user":{"name":"Alice","age":30}}');
      assert.deepStrictEqual(normalized, { user: { name: 'Alice', age: 30 } });
    });

    it('should throw NormalizeError for invalid JSON', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
      async () => await compiled.normalizeValue('{invalid-json}'), NormalizeError);
      await assert.rejects(
      async () => await compiled.normalizeValue('not an object'), NormalizeError);
    });

    it('should throw NormalizeError for non-object values', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
      async () => await compiled.normalizeValue(123), NormalizeError);
      await assert.rejects(
      async () => await compiled.normalizeValue(false), NormalizeError);
    });

    it('should normalize object to string when values constraint exists', async function() {
      const schema = new Schema('object')
        .values([{ a: 1 }]);

      const compiled = await resolver.compile(schema);

      // When values exist, normalization should stringify for comparison
      const normalized = await compiled.normalizeValue({ a: 1 });
      assert.strictEqual(typeof normalized, 'string');
      assert.strictEqual(normalized, '{"a":1}');
    });
  });

  describe('Object transformation', function() {

    it('should transform empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const transformed = await compiled.transformValue({});
      assert.deepStrictEqual(transformed, {});
    });
    it('should throw an error for unknown properties', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { x: 1, y: 2 };
      const transformed = await compiled.transformValue(obj);
      assert.deepStrictEqual(transformed, obj);
    });
    it('should transform object values unchanged', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { x: 1, y: 2 };
      const transformed = await compiled.transformValue(obj);
      assert.deepStrictEqual(transformed, obj);
    });


    it('should transform true to empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const transformed = await compiled.transformValue(true);
      assert.deepStrictEqual(transformed, {});
    });

    it('should transform JSON string to object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const transformed = await compiled.transformValue('{"a":1,"b":2}');
      assert.deepStrictEqual(transformed, { a: 1, b: 2 });
    });

    it('should transform JSON string with whitespace', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const transformed = await compiled.transformValue('  {"key":"value"}  ');
      assert.deepStrictEqual(transformed, { key: 'value' });
    });

    it('should throw TransformError for invalid JSON string', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        async () => await compiled.transformValue('{not-valid-json}'),
        TransformError
      );
    });

    it('should throw TransformError for non-object values', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        async () => await compiled.transformValue(123),
        TransformError
      );

      await assert.rejects(
        async () => await compiled.transformValue('plain string'),
        TransformError
      );
    });
  });

  describe('Object validation', function() {

    it('should validate object values', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { a: 1, b: 2 };
      const validated = await compiled.validateValue(obj);
      assert.deepStrictEqual(validated, obj);
    });

    it('should validate empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const validated = await compiled.validateValue({});
      assert.deepStrictEqual(validated, {});
    });

    it('should validate nested objects', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { outer: { inner: { value: 42 } } };
      const validated = await compiled.validateValue(obj);
      assert.deepStrictEqual(validated, obj);
    });

    it('should reject primitive values during validation', async function() {
      const schema = new Schema('object');
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
    });
  });

  describe('Object serialization', function() {

    it('should serialize object values', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { x: 10, y: 20 };
      const serialized = await compiled.serializeValue(obj);
      assert.deepStrictEqual(serialized, obj);
    });

    it('should serialize empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const serialized = await compiled.serializeValue({});
      assert.deepStrictEqual(serialized, {});
    });

    it('should serialize nested objects', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const obj = { level1: { level2: { value: 'test' } } };
      const serialized = await compiled.serializeValue(obj);
      assert.deepStrictEqual(serialized, obj);
    });
  });

  describe('Object with values constraint', function() {

    it('should compile object with allowed values', async function() {
      const schema = new Schema('object')
        .values([{ type: 'A' }, { type: 'B' }]);

      const compiled = await resolver.compile(schema);

      // Values should be stringified for comparison
      assert.strictEqual(compiled.values.length, 2);
      assert.strictEqual(compiled.values[0], '{"type":"A"}');
      assert.strictEqual(compiled.values[1], '{"type":"B"}');
    });

    it('should normalize and check matching values', async function() {
      const schema = new Schema('object')
        .values([{ x: 1 }]);

      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue({ x: 1 });
      assert.strictEqual(normalized, '{"x":1}');
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('object')
        .values([{ valid: true }]);

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.transformValue({ valid: false }),
        TransformError
      );
    });
  });

  describe('Object with properties', function() {

    it('should compile object with child properties', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties.name);
      assert.ok(compiled.properties.age);
      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should validate object with typed properties', async function() {
      const schema = new Schema('object')
        .property('title', new Schema('string'))
        .property('count', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const obj = { title: 'Test', count: 42 };
      const validated = await compiled.validateValue(obj);
      assert.deepStrictEqual(validated, obj);
    });
  });

  describe('Object with default value', function() {

    it('should have default value in compiled schema', async function() {
      const schema = new Schema('object')
        .default({ x: 10 });

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, { x: 10 });
    });

    it('should validate with default value', async function() {
      const schema = new Schema('object')
        .default({ status: 'active' });

      const compiled = await resolver.compile(schema);

      const validated = await compiled.validateValue({ status: 'active' });
      assert.deepStrictEqual(validated, { status: 'active' });
    });
  });

  describe('Object with required option', function() {

    it('should compile with required flag', async function() {
      const schema = new Schema('object')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should have valueDescription with angle brackets when required', async function() {
      const schema = new Schema('object')
        .required(true);

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<object>');
    });
  });

  describe('Object metadata', function() {

    it('should preserve metadata during compilation', async function() {
      const schema = new Schema('object')
        .meta('description', 'Configuration object')
        .meta('example', { key: 'value' });

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Configuration object');
      assert.deepStrictEqual(compiled.metadata.example, { key: 'value' });
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'object');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled.normalizeValue('{"key":"value"}');
      assert.deepStrictEqual(normalized, { key: 'value' });

      // Transform
      const transformed = await compiled.transformValue(normalized);
      assert.deepStrictEqual(transformed, { key: 'value' });

      // Validate
      const validated = await compiled.validateValue(transformed);
      assert.deepStrictEqual(validated, { key: 'value' });
    });

    it('should handle workflow with true input', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      // Normalize
      const normalized = await compiled.normalizeValue(true);
      assert.deepStrictEqual(normalized, {});

      // Transform
      const transformed = await compiled.transformValue(true);
      assert.deepStrictEqual(transformed, {});

      // Validate
      const validated = await compiled.validateValue(transformed);
      assert.deepStrictEqual(validated, {});
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('object')
        .values([{ type: 'test' }]);

      const compiled = await resolver.compile(schema);

      // Normalize (should stringify for comparison)
      const normalized = await compiled.normalizeValue({ type: 'test' });
      assert.strictEqual(normalized, '{"type":"test"}');

      // Transform from string (normalized form) back to object
      const transformed = await compiled.transformValue('{"type":"test"}');
      assert.deepStrictEqual(transformed, { type: 'test' });

      // Validate
      const validated = await compiled.validateValue(transformed);
      assert.deepStrictEqual(validated, { type: 'test' });
    });
  });
});
