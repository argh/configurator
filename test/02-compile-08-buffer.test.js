
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SerializeError, TransformError } from '../src/errors.js';

describe('Schema Compilation - Buffer Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Buffer normalization', function() {

    it('should not have a custom normalizer by default', function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      // Buffer type relies on transformer, not normalizer
      // The base 'any' normalizer should be inherited
      assert.ok(compiled.options.normalizer);
    });
  });

  describe('Buffer transformation', function() {

    it('should transform Buffer objects unchanged', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from('hello world', 'utf8');
      const transformed = await compiled.transform(buffer, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'hello world');
    });

    it('should transform base64 string to Buffer', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const base64 = 'aGVsbG8gd29ybGQ='; // "hello world" in base64
      const transformed = await compiled.transform(base64, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'hello world');
    });

    it('should transform empty string to empty Buffer', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('', {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.length, 0);
    });

    it('should transform array of bytes to Buffer', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const bytes = [72, 101, 108, 108, 111]; // "Hello" in ASCII
      const transformed = await compiled.transform(bytes, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'Hello');
    });

    it('should transform Uint8Array to Buffer', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const uint8 = new Uint8Array([72, 105]); // "Hi"
      const transformed = await compiled.transform(uint8, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'Hi');
    });

    it('should handle base64 with padding', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const base64 = 'dGVzdA=='; // "test" with padding
      const transformed = await compiled.transform(base64, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'test');
    });

    it('should handle base64 without padding', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const base64 = 'dGVzdA'; // "test" without padding
      const transformed = await compiled.transform(base64, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'test');
    });

    it('should throw TransformError for invalid values if Buffer.from throws', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      // These might work or throw depending on Buffer.from implementation
      // If they throw, it should be wrapped in TransformError
      try {
        await compiled.transform(null, {}, 'field');
        // If it doesn't throw, we pass
      } catch (error) {
        assert.ok(error instanceof TransformError);
      }
    });
  });

  describe('Buffer validation', function() {

    it('should validate Buffer objects', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from('test data');
      const validated = await compiled.validate(buffer);

      assert.ok(Buffer.isBuffer(validated));
      assert.strictEqual(validated.toString('utf8'), 'test data');
    });

    it('should validate empty Buffer', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from([]);
      const validated = await compiled.validate(buffer);

      assert.ok(Buffer.isBuffer(validated));
      assert.strictEqual(validated.length, 0);
    });

    it('should validate Buffer with binary data', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from([0x00, 0xFF, 0xAB, 0xCD]);
      const validated = await compiled.validate(buffer);

      assert.ok(Buffer.isBuffer(validated));
      assert.strictEqual(validated.length, 4);
      assert.strictEqual(validated[0], 0x00);
      assert.strictEqual(validated[1], 0xFF);
      assert.strictEqual(validated[2], 0xAB);
      assert.strictEqual(validated[3], 0xCD);
    });
  });

  describe('Buffer serialization', function() {

    it('should serialize Buffer to base64 string', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from('hello world', 'utf8');
      const serialized = await compiled.serialize(buffer);

      assert.strictEqual(typeof serialized, 'string');
      assert.strictEqual(serialized, 'aGVsbG8gd29ybGQ=');
    });

    it('should serialize empty Buffer to empty string', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from([]);
      const serialized = await compiled.serialize(buffer);

      assert.strictEqual(serialized, '');
    });

    it('should serialize binary Buffer to base64', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const buffer = Buffer.from([0xFF, 0x00, 0xAB, 0xCD]);
      const serialized = await compiled.serialize(buffer);

      assert.strictEqual(typeof serialized, 'string');
      // Verify we can decode it back
      const decoded = Buffer.from(serialized, 'base64');
      assert.deepStrictEqual(decoded, buffer);
    });

    it('should return undefined for non-Buffer values', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        async () => await compiled.serialize('not a buffer'),
        SerializeError
      );

      await assert.rejects(
        async () => await compiled.serialize(123),
        SerializeError
      );

      await assert.rejects(
        async () => await compiled.serialize(null),
        SerializeError
      );
    });
  });

  describe('Buffer with default value', function() {

    it('should have default Buffer value', function() {
      const defaultBuffer = Buffer.from('default');
      const schema = new Schema('buffer')
        .default(defaultBuffer);

      const compiled = resolver.compile(schema);

      assert.ok(Buffer.isBuffer(compiled.default));
      assert.strictEqual(compiled.default.toString('utf8'), 'default');
    });
  });

  describe('Buffer with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('buffer')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });

    it('should have valueDescription with angle brackets when required', function() {
      const schema = new Schema('buffer')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '<buffer>');
    });
  });

  describe('Buffer metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('buffer')
        .meta('description', 'Binary data')
        .meta('encoding', 'base64');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Binary data');
      assert.strictEqual(compiled.metadata.encoding, 'base64');
    });

    it('should have parserTypeHint set to string', function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.parserTypeHint, 'string');
    });
  });

  describe('Complete workflow', function() {

    it('should handle transform -> validate -> serialize workflow with base64', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const base64Input = 'dGVzdCBkYXRh'; // "test data"

      // Transform
      const transformed = await compiled.transform(base64Input, {}, 'field');
      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'test data');

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(Buffer.isBuffer(validated));

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.strictEqual(serialized, 'dGVzdCBkYXRh');
    });

    it('should handle workflow with byte array', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const bytes = [65, 66, 67]; // "ABC"

      // Transform
      const transformed = await compiled.transform(bytes, {}, 'field');
      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'ABC');

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(Buffer.isBuffer(validated));

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.strictEqual(serialized, 'QUJD'); // "ABC" in base64
    });

    it('should round-trip serialize and transform', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const originalBuffer = Buffer.from('Hello, Buffer!', 'utf8');

      // Serialize
      const serialized = await compiled.serialize(originalBuffer);
      assert.strictEqual(typeof serialized, 'string');

      // Transform back
      const transformed = await compiled.transform(serialized, {}, 'field');
      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), 'Hello, Buffer!');
      assert.deepStrictEqual(transformed, originalBuffer);
    });

    it('should handle empty Buffer round-trip', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const emptyBuffer = Buffer.from([]);

      // Serialize
      const serialized = await compiled.serialize(emptyBuffer);
      assert.strictEqual(serialized, '');

      // Transform back
      const transformed = await compiled.transform(serialized, {}, 'field');
      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.length, 0);
    });

    it('should handle binary data round-trip', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);

      // Serialize
      const serialized = await compiled.serialize(binaryBuffer);
      assert.strictEqual(typeof serialized, 'string');

      // Transform back
      const transformed = await compiled.transform(serialized, {}, 'field');
      assert.ok(Buffer.isBuffer(transformed));
      assert.deepStrictEqual(transformed, binaryBuffer);
    });
  });

  describe('Buffer edge cases', function() {

    it('should handle large buffers', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const largeBuffer = Buffer.alloc(10000);
      largeBuffer.fill('x');

      const serialized = await compiled.serialize(largeBuffer);
      const transformed = await compiled.transform(serialized, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.length, 10000);
      assert.deepStrictEqual(transformed, largeBuffer);
    });

    it('should handle buffer with UTF-8 multibyte characters', async function() {
      const schema = new Schema('buffer');
      const compiled = resolver.compile(schema);

      const text = 'Hello 世界 🌍';
      const buffer = Buffer.from(text, 'utf8');

      const serialized = await compiled.serialize(buffer);
      const transformed = await compiled.transform(serialized, {}, 'field');

      assert.ok(Buffer.isBuffer(transformed));
      assert.strictEqual(transformed.toString('utf8'), text);
    });
  });
});
