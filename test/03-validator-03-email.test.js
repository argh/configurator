
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: email', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Valid emails', function() {
    it('should accept simple email', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('user@example.com');
      assert.strictEqual(result, 'user@example.com');
    });

    it('should accept email with subdomain', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('user@mail.example.com');
      assert.strictEqual(result, 'user@mail.example.com');
    });

    it('should accept email with plus sign', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('user+tag@example.com');
      assert.strictEqual(result, 'user+tag@example.com');
    });

    it('should accept email with dots in local part', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('first.last@example.com');
      assert.strictEqual(result, 'first.last@example.com');
    });

    it('should accept email with numbers', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('user123@example123.com');
      assert.strictEqual(result, 'user123@example123.com');
    });

    it('should accept email with hyphens in domain', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      const result = await compiled.validateValue('user@my-domain.com');
      assert.strictEqual(result, 'user@my-domain.com');
    });
  });

  describe('Invalid emails', function() {
    it('should reject email without @', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('userexample.com'),
        ValidationError
      );
    });

    it('should reject email without domain', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('user@'),
        ValidationError
      );
    });

    it('should reject email without local part', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('@example.com'),
        ValidationError
      );
    });

    it('should reject email without TLD', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('user@example'),
        ValidationError
      );
    });

    it('should reject email with spaces', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('user @example.com'),
        ValidationError
      );
    });

    it('should reject email with multiple @', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue('user@@example.com'),
        ValidationError
      );
    });

    it('should reject empty string', async function() {
      const schema = new Schema('string').validator('$email');
      const compiled = await resolver.compile(schema);

      await assert.rejects(
        () => compiled.validateValue(''),
        ValidationError
      );
    });
  });
});
