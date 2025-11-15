
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: number', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept integers and return number', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('42', {}, '');
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept decimals and return number', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('3.14', {}, '');
    assert.strictEqual(result, 3.14);
  });

  it('should accept negative numbers', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('-42', {}, '');
    assert.strictEqual(result, -42);
  });

  it('should accept scientific notation', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('1e5', {}, '');
    assert.strictEqual(result, 100000);
  });

  it('should reject non-numeric strings', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc', {}, ''), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('Infinity', {}, ''), ValidationError);
  });

  it('should reject NaN', async function() {
    const schema = new Schema('string').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('NaN', {}, ''), ValidationError);
  });
});