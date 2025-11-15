
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: integer', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept positive integers and return number', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('42', {}, '');
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept negative integers', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('-42', {}, '');
    assert.strictEqual(result, -42);
  });

  it('should accept zero', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('0', {}, '');
    assert.strictEqual(result, 0);
  });

  it('should accept large integers', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('9007199254740991', {}, ''); // MAX_SAFE_INTEGER
    assert.strictEqual(result, 9007199254740991);
  });

  it('should reject decimals', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('3.14', {}, ''), ValidationError);
    // Note: '42.0' parses to 42 which IS an integer, so it passes
    const result = await compiled.validate('42.0', {}, '');
    assert.strictEqual(result, 42);
  });

  it('should reject non-numeric strings', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('abc', {}, ''), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('string').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('Infinity', {}, ''), ValidationError);
  });
});
