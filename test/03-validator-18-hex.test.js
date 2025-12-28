
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: hex', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept lowercase hex', async function() {
    const schema = new Schema('string').validator('$hex');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('abcdef0123456789');
  });

  it('should accept uppercase hex', async function() {
    const schema = new Schema('string').validator('$hex');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('ABCDEF0123456789');
  });

  it('should accept mixed case hex', async function() {
    const schema = new Schema('string').validator('$hex');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('AbCdEf0123');
  });

  it('should reject non-hex characters', async function() {
    const schema = new Schema('string').validator('$hex');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('12g4'), ValidationError);
    await assert.rejects(() => compiled.validateValue('hello'), ValidationError);
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$hex');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(''), ValidationError);
  });
});
