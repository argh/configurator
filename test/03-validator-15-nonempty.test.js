
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: nonempty', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept non-empty string', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    const result = await compiled.validate('hello', {}, '');
    assert.strictEqual(result, 'hello');
  });

  it('should accept string with only spaces if not trimmed to empty', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    // nonempty trims and checks, so only spaces will fail
    await assert.rejects(() => compiled.validate('   ', {}, ''), ValidationError);
  });

  it('should accept string with content and spaces', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    await compiled.validate('  hello  ', {}, '');
  });

  it('should accept numbers as strings', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    await compiled.validate('123', {}, '');
    await compiled.validate('0', {}, '');
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('', {}, ''), ValidationError);
  });

  it('should reject whitespace-only string', async function() {
    const schema = new Schema('string').validator('$nonempty');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('   ', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('\t\n', {}, ''), ValidationError);
  });
});