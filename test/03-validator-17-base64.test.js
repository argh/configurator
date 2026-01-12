
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: base64', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept valid base64 without padding', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('SGVsbG8'); // "Hello" in base64
  });

  it('should accept valid base64 with padding', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('SGVsbG8=');
    await compiled._validateValue('SGk=');
  });

  it('should accept empty string', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('');
  });

  it('should reject invalid characters', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('SGVs@G8='), ValidationError);
    await assert.rejects(() => compiled._validateValue('Hello!'), ValidationError);
  });

  it('should reject invalid padding', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('SGVs=G8'), ValidationError); // padding not at end
    await assert.rejects(() => compiled._validateValue('SGVs==='), ValidationError); // too much padding
  });

  it('should reject base64 with invalid padding length', async function() {
    const schema = new Schema('string').validator('$base64');
    const compiled = await resolver.compile(schema);

    // If padding is present, total length must be multiple of 4
    await assert.rejects(() => compiled._validateValue('A='), ValidationError); // length 2
    await assert.rejects(() => compiled._validateValue('AB='), ValidationError); // length 3
  });
});