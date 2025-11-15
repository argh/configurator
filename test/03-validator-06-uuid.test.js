
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: uuid', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept UUID v1', async function() {
    const schema = new Schema('string').validator('$uuid');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('550e8400-e29b-11d4-a716-446655440000', {}, '');
    assert.strictEqual(result, '550e8400-e29b-11d4-a716-446655440000');
  });

  it('should accept UUID v4', async function() {
    const schema = new Schema('string').validator('$uuid');
    const compiled = await resolver.compile(schema);

    await compiled.validate('123e4567-e89b-42d3-a456-426614174000', {}, '');
    await compiled.validate('c73bcdcc-2669-4bf6-81d3-e4ae73fb11fd', {}, '');
  });

  it('should accept lowercase and uppercase', async function() {
    const schema = new Schema('string').validator('$uuid');
    const compiled = await resolver.compile(schema);

    await compiled.validate('550e8400-e29b-11d4-a716-446655440000', {}, '');
    await compiled.validate('550E8400-E29B-11D4-A716-446655440000', {}, '');
  });

  it('should reject invalid UUID format', async function() {
    const schema = new Schema('string').validator('$uuid');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('not-a-uuid', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('550e8400-e29b-11d4-a716', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('550e8400e29b11d4a716446655440000', {}, ''), ValidationError); // no hyphens
    await assert.rejects(() => compiled.validate('', {}, ''), ValidationError);
  });
});