
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $url-encode / $url-decode', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('$url-encode', function() {
    it('should percent-encode special characters (component mode)', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-encode'));
      assert.strictEqual(await schema.transformValue('hello world'), 'hello%20world');
      assert.strictEqual(await schema.transformValue('a/b?c=d&e=f'), 'a%2Fb%3Fc%3Dd%26e%3Df');
      assert.strictEqual(await schema.transformValue('café'), 'caf%C3%A9');
    });

    it('should preserve structural URL characters in full mode', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({'$url-encode': {full: true}})
      );
      // encodeURI preserves :, /, ?, &, =
      assert.strictEqual(
        await schema.transformValue('https://example.com/path?q=hello world'),
        'https://example.com/path?q=hello%20world'
      );
    });

    it('should coerce non-strings to string before encoding', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-encode'));
      assert.strictEqual(await schema.transformValue(42), '42');
    });

    it('should round-trip with $url-decode', async function() {
      const encode = await resolver.compile(new Schema('any').transformer('$url-encode'));
      const decode = await resolver.compile(new Schema('any').transformer('$url-decode'));
      const original = 'hello world/path?foo=bar&baz=qux';
      assert.strictEqual(await decode.transformValue(await encode.transformValue(original)), original);
    });
  });

  describe('$url-decode', function() {
    it('should decode percent-encoded strings (component mode)', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-decode'));
      assert.strictEqual(await schema.transformValue('hello%20world'), 'hello world');
      assert.strictEqual(await schema.transformValue('caf%C3%A9'), 'café');
      assert.strictEqual(await schema.transformValue('a%2Fb'), 'a/b');
    });

    it('should leave unencoded strings unchanged', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-decode'));
      assert.strictEqual(await schema.transformValue('already clean'), 'already clean');
    });

    it('should throw for malformed percent sequences', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-decode'));
      await assert.rejects(() => schema.transformValue('%GG'), TransformError);
    });

    it('should throw for non-string inputs', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$url-decode'));
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue([1, 2, 3]), TransformError);
    });
  });
});
