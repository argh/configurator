
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: positive', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept positive integers and return number', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    const result = await compiled.validate('42', {}, '');
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept positive decimals', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    const result = await compiled.validate('3.14', {}, '');
    assert.strictEqual(result, 3.14);
  });

  it('should accept very small positive numbers', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    const result = await compiled.validate('0.0001', {}, '');
    assert.strictEqual(result, 0.0001);
  });

  it('should reject zero', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('0', {}, ''), ValidationError);
  });

  it('should reject negative numbers', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('-42', {}, ''), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('Infinity', {}, ''), ValidationError);
  });

  it('should reject non-numeric strings', async function() {
    const schema = new Schema('string').validator('$positive');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc', {}, ''), ValidationError);
  });
});