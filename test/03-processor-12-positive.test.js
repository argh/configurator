
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: positive', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept positive integers', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(42);
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept positive decimals', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(3.14);
    assert.strictEqual(result, 3.14);
  });

  it('should accept very small positive numbers', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue(0.0001);
    assert.strictEqual(result, 0.0001);
  });

  it('should reject zero', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(0), ValidationError);
  });

  it('should reject negative numbers', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(-42), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(Infinity), ValidationError);
  });

  it('should reject non-number values', async function() {
    const schema = new Schema('any').validator('$positive');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('42'), ValidationError);
  });
});
