
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: number', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept integers and return number', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('42');
    assert.strictEqual(result, 42);
    assert.strictEqual(typeof result, 'number');
  });

  it('should accept decimals and return number', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('3.14');
    assert.strictEqual(result, 3.14);
  });

  it('should accept negative numbers', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('-42');
    assert.strictEqual(result, -42);
  });

  it('should accept scientific notation', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('1e5');
    assert.strictEqual(result, 100000);
  });

  it('should reject non-numeric strings', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('abc'), ValidationError);
  });

  it('should reject Infinity', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('Infinity'), ValidationError);
  });

  it('should reject NaN', async function() {
    const schema = new Schema('any').validator('$number');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('NaN'), ValidationError);
  });
});