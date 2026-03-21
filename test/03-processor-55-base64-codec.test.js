
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $base64-encode / $base64-decode', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('$base64-encode', function() {
    it('should encode a Buffer to a base64 string', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$base64-encode'));
      assert.strictEqual(await schema.transformValue(Buffer.from('Hello')), 'SGVsbG8=');
      assert.strictEqual(await schema.transformValue(Buffer.from('')), '');
    });

    it('should produce output decodable by $base64-decode', async function() {
      const encode = await resolver.compile(new Schema('any').transformer('$base64-encode'));
      const decode = await resolver.compile(new Schema('any').transformer('$base64-decode'));
      const original = Buffer.from('round-trip test');
      const encoded = await encode.transformValue(original);
      const decoded = await decode.transformValue(encoded);
      assert.deepStrictEqual(decoded, original);
    });

    it('should throw for non-Buffer inputs', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$base64-encode'));
      await assert.rejects(() => schema.transformValue('already a string'), TransformError);
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
      // null is a universal prune signal and bypasses all transformers by design
    });
  });

  describe('$base64-decode', function() {
    it('should decode a base64 string to a Buffer', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$base64-decode'));
      const result = await schema.transformValue('SGVsbG8=');
      assert.ok(Buffer.isBuffer(result));
      assert.strictEqual(result.toString('utf8'), 'Hello');
    });

    it('should decode an empty string to an empty Buffer', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$base64-decode'));
      const result = await schema.transformValue('');
      assert.ok(Buffer.isBuffer(result));
      assert.strictEqual(result.length, 0);
    });

    it('should throw for non-string inputs', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$base64-decode'));
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue(Buffer.from('x')), TransformError);
      await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
    });
  });
});
