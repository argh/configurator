
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, NormalizeError } from '../src/errors.js';

describe('Process - Basic Value Processing', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple values', function() {

    it('should process a primitive string value', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.process('hello');

      assert.strictEqual(result, 'hello');
    });

    it('should process a primitive number value', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      const result = await compiled.process(42);

      assert.strictEqual(result, 42);
    });

    it('should normalize string to number', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      const result = await compiled.process('123');

      assert.strictEqual(result, 123);
    });

    it('should process undefined input', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.process(undefined);

      assert.strictEqual(result, undefined);
    });
  });

  describe('Object values', function() {

    it('should process a simple object', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({ name: 'Alice', age: 30 });

      assert.deepStrictEqual(result, { name: 'Alice', age: 30 });
    });

    it('should process nested objects', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('name', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({
        user: {
          profile: {
            name: 'Bob'
          }
        }
      });

      assert.deepStrictEqual(result, {
        user: {
          profile: {
            name: 'Bob'
          }
        }
      });
    });

    it('should apply defaults for missing properties', async function() {
      const schema = new Schema('object')
        .property('host', new Schema('string'))
        .property('port', new Schema('number').default(8080));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process({ host: 'localhost' });

      assert.deepStrictEqual(result, { host: 'localhost', port: 8080 });
    });
  });

  describe('Array values', function() {

    it('should process a simple array', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process(['a', 'b', 'c']);

      assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    it('should process array of objects', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('object')
          .property('id', new Schema('number'))
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      const result = await compiled.process([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' }
      ]);

      assert.deepStrictEqual(result, [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' }
      ]);
    });

    it('should normalize array element values', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('number'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.process(['1', '2', '3']);

      assert.deepStrictEqual(result, [1, 2, 3]);
    });
  });
});
