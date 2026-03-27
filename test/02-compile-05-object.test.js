
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ConstraintError, NormalizeError, TransformError, ValidationError } from '../src/schema/schema-errors.js';
import { EMPTY } from '../src/schema/constants.js';

describe('Schema Compilation - Object Type', function() {
  /** @type {SchemaResolver} */
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

    it('should normalize EMPTY to empty object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue(EMPTY);
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

      assert.strictEqual(compiled.values.length, 2);
      assert.deepStrictEqual(compiled.values[0], {type:'A'});
      assert.deepStrictEqual(compiled.values[1], {type:'B'});
    });

    it('should allow mismatched value during normalization', async function() {
      const schema = new Schema('object')
        .values([{ x: 1 }]);

      const compiled = await resolver.compile(schema);

      const normalized = await compiled.normalizeValue({ x: 2 });
      assert.deepStrictEqual(normalized, {x: 2});
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
      assert.deepStrictEqual(compiled.metadata.example, JSON.stringify({ key: 'value' }));
    });

    it('should have valueName set from base type', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'object');
    });
  });


});
