
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

import { ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: $non-empty', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept non-empty string', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue('hello');
    assert.strictEqual(result, 'hello');
  });

  it('should accept string with only spaces if not trimmed to empty', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    // nonempty trims and checks, so only spaces will fail
    await assert.rejects(() => compiled.validateValue('   '), ValidationError);
  });

  it('should accept string with content and spaces', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('  hello  ');
  });

  it('should accept numbers as strings', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('123');
    await compiled.validateValue('0');
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue(''), ValidationError);
  });

  it('should reject whitespace-only string', async function() {
    const schema = new Schema('string').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('   '), ValidationError);
    await assert.rejects(() => compiled.validateValue('\t\n'), ValidationError);
  });

  it('should accept non-empty arrays', async function() {
    const schema = new Schema('any').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue([1, 2, 3]);
    assert.deepStrictEqual(result, [1, 2, 3]);

    await compiled.validateValue(['item']);
    await compiled.validateValue([null]);     // single null element still counts
    await compiled.validateValue([undefined]); // single undefined element still counts
  });

  it('should reject empty arrays', async function() {
    const schema = new Schema('any').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue([]), ValidationError);
  });

  it('should accept non-empty objects', async function() {
    const schema = new Schema('any').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validateValue({ hello: 'world' });
    assert.deepStrictEqual(result, { hello: 'world' });

    await compiled.validateValue({ a: 1, b: 2 });
  });

  it('should reject empty objects', async function() {
    const schema = new Schema('any').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue({}), ValidationError);
  });

  it('should pass through other primitive values unchanged', async function() {
    const schema = new Schema('any').validator('$non-empty');
    const compiled = await resolver.compile(schema);

    // Numbers, booleans — not string/array/object, not null/undefined, so passed through
    assert.strictEqual(await compiled.validateValue(42), 42);
    assert.strictEqual(await compiled.validateValue(0), 0);
    assert.strictEqual(await compiled.validateValue(true), true);
    assert.strictEqual(await compiled.validateValue(false), false);
  });
});
