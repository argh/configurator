
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

    it('should normalize object values unchanged', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { a: 1, b: 2 };
      const normalized = compiled.normalize(obj);
      assert.deepStrictEqual(normalized, obj);
    });

    it('should normalize empty object', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = {};
      const normalized = compiled.normalize(obj);
      assert.deepStrictEqual(normalized, obj);
    });

    it('should normalize true to empty object', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize(true);
      assert.deepStrictEqual(normalized, {});
    });

    it('should normalize JSON string to object', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('{"x":10,"y":20}');
      assert.deepStrictEqual(normalized, { x: 10, y: 20 });
    });

    it('should normalize JSON string with nested objects', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize('{"user":{"name":"Alice","age":30}}');
      assert.deepStrictEqual(normalized, { user: { name: 'Alice', age: 30 } });
    });

    it('should throw NormalizeError for invalid JSON', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      assert.throws(() => compiled.normalize('{invalid-json}'), NormalizeError);
      assert.throws(() => compiled.normalize('not an object'), NormalizeError);
    });

    it('should throw NormalizeError for non-object values', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      assert.throws(() => compiled.normalize(123), NormalizeError);
      assert.throws(() => compiled.normalize(false), NormalizeError);
    });

    it('should normalize object to string when values constraint exists', function() {
      const schema = new Schema('object')
        .values([{ a: 1 }]);

      const compiled = resolver.compile(schema);

      // When values exist, normalization should stringify for comparison
      const normalized = compiled.normalize({ a: 1 });
      assert.strictEqual(typeof normalized, 'string');
      assert.strictEqual(normalized, '{"a":1}');
    });
  });

  describe('Object transformation', function() {

    it('should transform object values unchanged', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { x: 1, y: 2 };
      const transformed = await compiled.transform(obj, {}, 'field');
      assert.deepStrictEqual(transformed, obj);
    });

    it('should transform empty object', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform({}, {}, 'field');
      assert.deepStrictEqual(transformed, {});
    });

    it('should transform true to empty object', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform(true, {}, 'field');
      assert.deepStrictEqual(transformed, {});
    });

    it('should transform JSON string to object', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('{"a":1,"b":2}', {}, 'field');
      assert.deepStrictEqual(transformed, { a: 1, b: 2 });
    });

    it('should transform JSON string with whitespace', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('  {"key":"value"}  ', {}, 'field');
      assert.deepStrictEqual(transformed, { key: 'value' });
    });

    it('should throw TransformError for invalid JSON string', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        async () => await compiled.transform('{not-valid-json}', {}, 'field'),
        TransformError
      );
    });

    it('should throw TransformError for non-object values', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        async () => await compiled.transform(123, {}, 'field'),
        TransformError
      );

      await assert.rejects(
        async () => await compiled.transform('plain string', {}, 'field'),
        TransformError
      );
    });
  });

  describe('Object validation', function() {

    it('should validate object values', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { a: 1, b: 2 };
      const validated = await compiled.validate(obj);
      assert.deepStrictEqual(validated, obj);
    });

    it('should validate empty object', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const validated = await compiled.validate({});
      assert.deepStrictEqual(validated, {});
    });

    it('should validate nested objects', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { outer: { inner: { value: 42 } } };
      const validated = await compiled.validate(obj);
      assert.deepStrictEqual(validated, obj);
    });

    it('should reject primitive values during validation', async function() {
      const schema = new Schema('object');
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
    });
  });

  describe('Object serialization', function() {

    it('should serialize object values', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { x: 10, y: 20 };
      const serialized = await compiled.serialize(obj);
      assert.deepStrictEqual(serialized, obj);
    });

    it('should serialize empty object', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const serialized = await compiled.serialize({});
      assert.deepStrictEqual(serialized, {});
    });

    it('should serialize nested objects', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      const obj = { level1: { level2: { value: 'test' } } };
      const serialized = await compiled.serialize(obj);
      assert.deepStrictEqual(serialized, obj);
    });
  });

  describe('Object with values constraint', function() {

    it('should compile object with allowed values', function() {
      const schema = new Schema('object')
        .values([{ type: 'A' }, { type: 'B' }]);

      const compiled = resolver.compile(schema);

      // Values should be stringified for comparison
      assert.strictEqual(compiled.values.length, 2);
      assert.strictEqual(compiled.values[0], '{"type":"A"}');
      assert.strictEqual(compiled.values[1], '{"type":"B"}');
    });

    it('should normalize and check matching values', function() {
      const schema = new Schema('object')
        .values([{ x: 1 }]);

      const compiled = resolver.compile(schema);

      const normalized = compiled.normalize({ x: 1 });
      assert.strictEqual(normalized, '{"x":1}');
    });

    it('should reject non-matching values during transformation', async function() {
      const schema = new Schema('object')
        .values([{ valid: true }]);

      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform({ valid: false }, {}, 'field'),
        TransformError
      );
    });
  });

  describe('Object with properties', function() {

    it('should compile object with child properties', function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.name);
      assert.ok(compiled.properties.age);
      assert.strictEqual(compiled.hasChildren, true);
    });

    it('should validate object with typed properties', async function() {
      const schema = new Schema('object')
        .property('title', new Schema('string'))
        .property('count', new Schema('number'));

      const compiled = resolver.compile(schema);

      const obj = { title: 'Test', count: 42 };
      const validated = await compiled.validate(obj);
      assert.deepStrictEqual(validated, obj);
    });
  });

  describe('Object with default value', function() {

    it('should have default value in compiled schema', function() {
      const schema = new Schema('object')
        .default({ x: 10 });

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.default, { x: 10 });
    });

    it('should validate with default value', async function() {
      const schema = new Schema('object')
        .default({ status: 'active' });

      const compiled = resolver.compile(schema);

      const validated = await compiled.validate({ status: 'active' });
      assert.deepStrictEqual(validated, { status: 'active' });
    });
  });

  describe('Object with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('object')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should have valueDescription with angle brackets when required', function() {
      const schema = new Schema('object')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<object>');
    });
  });

  describe('Object metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('object')
        .meta('description', 'Configuration object')
        .meta('example', { key: 'value' });

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Configuration object');
      assert.deepStrictEqual(compiled.metadata.example, { key: 'value' });
    });

    it('should have valueName set from base type', function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'object');
    });
  });

  describe('Complete workflow', function() {

    it('should handle normalize -> transform -> validate workflow', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize('{"key":"value"}');
      assert.deepStrictEqual(normalized, { key: 'value' });

      // Transform
      const transformed = await compiled.transform(normalized, {}, 'field');
      assert.deepStrictEqual(transformed, { key: 'value' });

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, { key: 'value' });
    });

    it('should handle workflow with true input', async function() {
      const schema = new Schema('object');
      const compiled = resolver.compile(schema);

      // Normalize
      const normalized = compiled.normalize(true);
      assert.deepStrictEqual(normalized, {});

      // Transform
      const transformed = await compiled.transform(true, {}, 'field');
      assert.deepStrictEqual(transformed, {});

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, {});
    });

    it('should handle full workflow with values constraint', async function() {
      const schema = new Schema('object')
        .values([{ type: 'test' }]);

      const compiled = resolver.compile(schema);

      // Normalize (should stringify for comparison)
      const normalized = compiled.normalize({ type: 'test' });
      assert.strictEqual(normalized, '{"type":"test"}');

      // Transform from string (normalized form) back to object
      const transformed = await compiled.transform('{"type":"test"}', {}, 'field');
      assert.deepStrictEqual(transformed, { type: 'test' });

      // Validate
      const validated = await compiled.validate(transformed);
      assert.deepStrictEqual(validated, { type: 'test' });
    });
  });
});
