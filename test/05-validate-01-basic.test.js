
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validate - Basic Validation', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple values', function() {

    it('should validate a valid string', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validate('hello');

      assert.strictEqual(result, 'hello');
    });

    it('should validate a valid number', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(42);

      assert.strictEqual(result, 42);
    });

    it('should validate a valid boolean', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(true);

      assert.strictEqual(result, true);
    });

    it('should validate undefined input', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(undefined);

      assert.strictEqual(result, undefined);
    });
  });

  describe('Object values', function() {

    it('should validate a simple object', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ name: 'Alice', age: 30 });

      assert.deepStrictEqual(result, { name: 'Alice', age: 30 });
    });

    it('should validate nested objects', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('name', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const input = { user: { profile: { name: 'Bob' } } };
      const result = await compiled.validate(input);

      assert.deepStrictEqual(result, { user: { profile: { name: 'Bob' } } });
    });

    it('should validate object with missing optional properties', async function() {
      const schema = new Schema('object')
        .property('required', new Schema('string'))
        .property('optional', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ required: 'value' });

      assert.deepStrictEqual(result, { required: 'value' });
    });
  });

  describe('Array values', function() {

    it('should validate a simple array', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate(['a', 'b', 'c']);

      assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    it('should validate array of objects', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('id', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate([{ id: 1 }, { id: 2 }]);

      assert.deepStrictEqual(result, [{ id: 1 }, { id: 2 }]);
    });

    it('should validate empty array', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'))
        .allowEmpty();

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate([]);

      assert.deepStrictEqual(result, []);
    });
  });

  describe('Custom validators', function() {

    it('should run custom validator and return validated value', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value.length < 3) {
            throw new ValidationError('String must be at least 3 characters');
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate('hello');
      assert.strictEqual(result, 'hello');
    });

    it('should throw on custom validator failure', async function() {
      const schema = new Schema('string')
        .validator((value) => {
          if (value.length < 3) {
            throw new ValidationError('String must be at least 3 characters');
          }
          return value;
        });

      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('ab'),
        ValidationError
      );
    });

    it('should allow validator to mutate/transform value in container', async function() {
      // Note: Root-level mutation currently throws "Unable to finalize a stable output value"
      // Mutation works within containers (objects/arrays)
      const schema = new Schema('object')
        .property('text', new Schema('string')
          .validator((value) => value.trim().toLowerCase())
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.validate({ text: '  HELLO  ' });

      assert.strictEqual(result.text, 'hello');
    });
  });
});
