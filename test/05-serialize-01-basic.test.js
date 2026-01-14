
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Serialize - Basic Serialization', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple values', function() {

    it('should serialize primitives unchanged', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('count', new Schema('number'))
        .property('active', new Schema('boolean'));

      const compiled = await resolver.compile(schema);

      const input = { name: 'test', count: 42, active: true };
      const result = await compiled.serialize(input);

      assert.deepStrictEqual(result, { name: 'test', count: 42, active: true });
    });

    it('should serialize arrays', async function() {
      const schema = new Schema('array')
        .property('*', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const result = await compiled.serialize(['a', 'b', 'c']);

      assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    it('should serialize nested objects', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = await resolver.compile(schema);

      const input = { config: { host: 'localhost', port: 8080 } };
      const result = await compiled.serialize(input);

      assert.deepStrictEqual(result, { config: { host: 'localhost', port: 8080 } });
    });
  });

  describe('Complex type simplification', function() {

    it('should serialize Date to ISO string', async function() {
      const schema = new Schema('object')
        .property('timestamp', new Schema('date'));

      const compiled = await resolver.compile(schema);

      const date = new Date('2025-01-15T10:30:00.000Z');
      const input = { timestamp: date };
      const result = await compiled.serialize(input);

      assert.strictEqual(result.timestamp, '2025-01-15T10:30:00.000Z');
    });

    it('should serialize Buffer to base64 string', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('buffer'));

      const compiled = await resolver.compile(schema);

      const input = { data: Buffer.from('hello world') };
      const result = await compiled.serialize(input);

      assert.strictEqual(result.data, 'aGVsbG8gd29ybGQ=');
    });

    it('should use custom serializer', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('number')
          .serializer((v) => `$${v.toFixed(2)}`)
        );

      const compiled = await resolver.compile(schema);

      const input = { value: 19.99 };
      const result = await compiled.serialize(input);

      assert.strictEqual(result.value, '$19.99');
    });
  });

  describe('omitFromSerialize metadata', function() {

    it('should omit properties marked with omitFromSerialize', async function() {
      const schema = new Schema('object')
        .property('visible', new Schema('string'))
        .property('internal', new Schema('string')
          .meta('omitFromSerialize')
        );

      const compiled = await resolver.compile(schema);

      const input = { visible: 'shown', internal: 'hidden' };
      const result = await compiled.serialize(input);

      assert.strictEqual(result.visible, 'shown');
      assert.strictEqual(result.internal, undefined);
      assert.ok(!('internal' in result));
    });

    it('should omit nested properties marked with omitFromSerialize', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('public', new Schema('string'))
          .property('secret', new Schema('string')
            .meta('omitFromSerialize')
          )
        );

      const compiled = await resolver.compile(schema);

      const input = { config: { public: 'value', secret: 'password' } };
      const result = await compiled.serialize(input);

      assert.strictEqual(result.config.public, 'value');
      assert.ok(!('secret' in result.config));
    });

    it('should omit inherit() values from serialization', async function() {
      const schema = new Schema('object')
        .property('env', new Schema('string'))
        .property('service', new Schema('object')
          .property('env', Schema.inherit())
          .property('name', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      // First process to get inherited values
      const processed = await compiled.process({ env: 'production', service: { name: 'api' } });
      assert.strictEqual(processed.service.env, 'production');

      // Serialize should omit inherited value
      const result = await compiled.serialize(processed);
      assert.strictEqual(result.env, 'production');
      assert.strictEqual(result.service.name, 'api');
      assert.ok(!('env' in result.service));
    });
  });

  describe('Edge cases', function() {

    it('should handle undefined input', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      const result = await compiled.serialize(undefined);

      assert.strictEqual(result, undefined);
    });

    it('should prune undefined values from objects', async function() {
      const schema = new Schema('object')
        .property('present', new Schema('string'))
        .property('missing', new Schema('string'));

      const compiled = await resolver.compile(schema);

      const input = { present: 'value' };
      const result = await compiled.serialize(input);

      assert.deepStrictEqual(result, { present: 'value' });
      assert.ok(!('missing' in result));
    });
  });
});
