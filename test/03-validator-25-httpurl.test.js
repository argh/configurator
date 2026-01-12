
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: httpurl', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept HTTP URL', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    const result = await compiled._validateValue('http://example.com');
    assert.strictEqual(result, 'http://example.com');
  });

  it('should accept HTTPS URL', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('https://example.com');
    await compiled._validateValue('https://example.com/path');
    await compiled._validateValue('https://example.com:8080/path?query=value');
  });

  it('should reject FTP URL', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('ftp://example.com'),
      ValidationError
    );
  });

  it('should reject file URL', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('file:///path/to/file'),
      ValidationError
    );
  });

  it('should reject URL without protocol', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('example.com'),
      ValidationError
    );
  });

  it('should reject malformed URL', async function() {
    const schema = new Schema('string').validator('$httpurl');
    const compiled = await resolver.compile(schema);

    await assert.rejects(
      () => compiled._validateValue('http://'),
      ValidationError
    );
  });
});