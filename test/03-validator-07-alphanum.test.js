
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: alphanum', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept letters only', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    await compiled.validate('abcABC', {}, '');
  });

  it('should accept numbers only', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    await compiled.validate('123456', {}, '');
  });

  it('should accept mix of letters and numbers', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    const result = await compiled.validate('abc123XYZ789', {}, '');
    assert.strictEqual(result, 'abc123XYZ789');
  });

  it('should reject spaces', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc 123', {}, ''), ValidationError);
  });

  it('should reject special characters', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc-123', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('abc_123', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('abc.123', {}, ''), ValidationError);
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$alphanum');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('', {}, ''), ValidationError);
  });
});