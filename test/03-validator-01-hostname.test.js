
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: hostname', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Valid hostnames', function() {
    it('should accept simple hostname', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('example');
      assert.strictEqual(result, 'example');
    });

    it('should accept hostname with domain', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('example.com');
      assert.strictEqual(result, 'example.com');
    });

    it('should accept subdomain', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('www.example.com');
      assert.strictEqual(result, 'www.example.com');
    });

    it('should accept deep subdomain', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('api.v2.example.com');
      assert.strictEqual(result, 'api.v2.example.com');
    });

    it('should accept hostname with hyphens', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('my-server.example-site.com');
      assert.strictEqual(result, 'my-server.example-site.com');
    });

    it('should accept hostname with numbers', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('server1.example2.com');
      assert.strictEqual(result, 'server1.example2.com');
    });

    it('should accept single character labels', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('a.b.c');
      assert.strictEqual(result, 'a.b.c');
    });
  });

  describe('Invalid hostnames', function() {
    it('should reject hostname starting with hyphen', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('-invalid.com'),
        ValidationError
      );
    });

    it('should reject hostname ending with hyphen', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('invalid-.com'),
        ValidationError
      );
    });

    it('should reject hostname with underscore', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('invalid_host.com'),
        ValidationError
      );
    });

    it('should reject hostname with spaces', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('invalid host.com'),
        ValidationError
      );
    });

    it('should reject hostname with special characters', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('invalid@host.com'),
        ValidationError
      );
    });

    it('should reject empty string', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue(''),
        ValidationError
      );
    });

    it('should reject hostname with consecutive dots', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('invalid..com'),
        ValidationError
      );
    });
  });

  describe('Edge cases', function() {
    it('should accept localhost', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('localhost');
      assert.strictEqual(result, 'localhost');
    });

    it('should accept long hostname', async function() {
      const schema = new Schema('string').validator('$hostname');
      const compiled = await resolver.compile(schema);

      const longLabel = 'a'.repeat(63);
      const result = await compiled.validateValue(`${longLabel}.com`);
      assert.strictEqual(result, `${longLabel}.com`);
    });
  });
});
