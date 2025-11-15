
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: alpha', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept lowercase letters', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('abcdefghijklmnopqrstuvwxyz', {}, '');
    assert.strictEqual(result, 'abcdefghijklmnopqrstuvwxyz');
  });

  it('should accept uppercase letters', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await compiled.validate('ABCDEFGHIJKLMNOPQRSTUVWXYZ', {}, '');
  });

  it('should accept mixed case', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await compiled.validate('AbCdEfGh', {}, '');
  });

  it('should reject numbers', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc123', {}, ''), ValidationError);
  });

  it('should reject spaces', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc def', {}, ''), ValidationError);
  });

  it('should reject special characters', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc-def', {}, ''), ValidationError);
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$alpha');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('', {}, ''), ValidationError);
  });
});
