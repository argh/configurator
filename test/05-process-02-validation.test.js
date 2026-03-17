
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { NormalizeError, ValidationError } from '../src/schema/schema-errors.js';

describe('Process - Validation and Edge Cases', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Extra properties (strict mode)', function() {

    it('should reject objects with unknown properties in strict mode', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ name: 'Alice', extra: 'field' }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.includes('extra'));
          return true;
        }
      );
    });

    it('should reject nested objects with unknown properties', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ user: { name: 'Bob', unknown: 'value' } }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.includes('unknown'));
          return true;
        }
      );
    });

    it('should reject deeply nested unknown properties', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ a: { b: { c: 'value', d: 'extra' } } }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          return true;
        }
      );
    });
  });

  describe('Extra properties (lax mode)', function() {

    it('should allow unknown properties when schema is lax', async function() {
      const schema = new Schema('object')
        .lax()
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({ name: 'Alice', extra: 'ignored' });

      // Unknown properties are silently dropped
      assert.deepStrictEqual(result, { name: 'Alice' });
    });

    it('should allow unknown properties with strict:false option', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process(
        { name: 'Alice', extra: 'ignored' },
        undefined,
        { strict: false }
      );

      assert.deepStrictEqual(result, { name: 'Alice' });
    });

    it('should allow nested unknown properties in lax mode', async function() {
      const schema = new Schema('object')
        .lax()
        .property('user', new Schema('object')
          .lax()
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({
        user: { name: 'Bob', extra: 'field' },
        unknown: 'top-level'
      });

      assert.deepStrictEqual(result, { user: { name: 'Bob' } });
    });
  });

  describe('Error propagation', function() {

    it('should propagate normalization errors from nested values', async function() {
      // Just verify that errors bubble up correctly - type handling is tested elsewhere
      const schema = new Schema('object')
        .property('count', new Schema('number'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ count: 'not-a-number' }),
        (err) => {
          assert.ok(err instanceof NormalizeError || err instanceof ValidationError);
          return true;
        }
      );
    });

    it('should propagate errors from array elements', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process([1, 2, 'invalid']),
        (err) => {
          assert.ok(err instanceof NormalizeError || err instanceof ValidationError);
          return true;
        }
      );
    });
  });

  describe('Wildcard properties', function() {

    it('should accept any property names with wildcard schema', async function() {
      const schema = new Schema('object')
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({
        foo: 'value1',
        bar: 'value2',
        baz: 'value3'
      });

      assert.deepStrictEqual(result, {
        foo: 'value1',
        bar: 'value2',
        baz: 'value3'
      });
    });

    it('should validate wildcard property values', async function() {
      const schema = new Schema('object')
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ a: 1, b: 'not a number' }),
        (err) => {
          assert.ok(err instanceof NormalizeError || err instanceof ValidationError);
          return true;
        }
      );
    });

    it('should mix explicit and wildcard properties', async function() {
      const schema = new Schema('object')
        .property('id', new Schema('number'))
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({
        id: 123,
        name: 'test',
        description: 'something'
      });

      assert.deepStrictEqual(result, {
        id: 123,
        name: 'test',
        description: 'something'
      });
    });
  });

  describe('Required properties', function() {

    it('should reject missing required properties', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string').required())
        .property('optional', new Schema('string'));

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.process({ optional: 'value' }),
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.message.includes('name'));
          return true;
        }
      );
    });

    it('should accept when required property is present', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string').required())
        .property('optional', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({ name: 'Alice' });

      assert.deepStrictEqual(result, { name: 'Alice' });
    });
  });

  describe('Processing with target', function() {

    it('should merge input with existing target', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('string'))
        .property('b', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const target = { a: 'existing' };
      const result = await compiled.process({ b: 'new' }, target);

      assert.deepStrictEqual(result, { a: 'existing', b: 'new' });
    });

    it('should override target properties with input', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const target = { value: 'old' };
      const result = await compiled.process({ value: 'new' }, target);

      assert.deepStrictEqual(result, { value: 'new' });
    });
  });
});
