
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: integer', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept positive integers', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(42);
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept negative integers', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(-42);
    assert.strictEqual(result, -42);
  });

  it('should accept zero', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(0);
    assert.strictEqual(result, 0);
  });

  it('should accept large integers', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(Number.MAX_SAFE_INTEGER);
    assert.strictEqual(result, Number.MAX_SAFE_INTEGER);
  });

  it('should accept whole-valued floats', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    // 42.0 === 42 in JS — Number.isInteger(42.0) is true
    const result = await compiled.validateValue(42.0);
    assert.strictEqual(result, 42);
  });

  it('should reject decimals', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(3.14), ValidationError);
  });

  it('should reject non-number values', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('42'), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('any').validator('$integer');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(Infinity), ValidationError);
  });
});
