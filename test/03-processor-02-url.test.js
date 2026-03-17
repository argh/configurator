
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: url', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Valid URLs', function() {
    it('should accept HTTP URL', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('http://example.com');
      assert.strictEqual(result, 'http://example.com/');
    });

    it('should accept HTTPS URL', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('https://example.com');
      assert.strictEqual(result, 'https://example.com/');
    });

    it('should accept URL with path', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('https://example.com/path/to/page');
      assert.strictEqual(result, 'https://example.com/path/to/page');
    });

    it('should accept URL with query string', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('https://example.com?foo=bar');
      assert.strictEqual(result, 'https://example.com/?foo=bar');
    });

    it('should accept URL with hash', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('https://example.com#section');
      assert.strictEqual(result, 'https://example.com/#section');
    });

    it('should accept URL with port', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('https://example.com:8080/path');
      assert.strictEqual(result, 'https://example.com:8080/path');
    });

    it('should accept file protocol URL', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('file:///path/to/file');
      assert.strictEqual(result, 'file:///path/to/file');
    });

    it('should accept FTP URL', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('ftp://ftp.example.com/file.txt');
      assert.strictEqual(result, 'ftp://ftp.example.com/file.txt');
    });
  });

  describe('Invalid URLs', function() {
    it('should reject URL without protocol', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('example.com'),
        ValidationError
      );
    });

    it('should reject empty string', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue(''),
        ValidationError
      );
    });

    it('should reject malformed URL', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('http://'),
        ValidationError
      );
    });

    it('should accept valid URL with special characters', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      // URL constructor acceots many characters, including query params
      const result = await compiled.validateValue('http://example.com/path?query=value');
      assert.strictEqual(result, 'http://example.com/path?query=value');
    });
  });

  describe('URL normalization', function() {
    it('should normalize URL by adding trailing slash', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('http://example.com');
      assert.strictEqual(result, 'http://example.com/');
    });

    it('should preserve existing path', async function() {
      const schema = new Schema('string').validator('$url');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('http://example.com/page');
      assert.strictEqual(result, 'http://example.com/page');
    });
  });
});