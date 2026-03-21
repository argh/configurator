
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: $has-prefix', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // missing required match parameter
    await assert.rejects(() => resolver.compile(new Schema('any').validator('$has-prefix')), SchemaError);
    await assert.rejects(() => resolver.compile(new Schema('any').validator({'$has-prefix': {}})), SchemaError);

    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').validator({'$has-prefix': {unexpected: 'foo'}})),
      SchemaError
    );
  });

  it('should pass through the input when it starts with the required prefix', async function() {
    const schema = await resolver.compile(new Schema('any').validator({'$has-prefix': {match: 'http'}}));

    assert.strictEqual(await schema.validateValue('http://example.com'), 'http://example.com');
    assert.strictEqual(await schema.validateValue('https://example.com'), 'https://example.com');
    assert.strictEqual(await schema.validateValue('http'), 'http'); // exact match is also a valid prefix

    // shorthand positional: {'$has-prefix': 'foo'} treated as {'$has-prefix': {match: 'foo'}}
    const shorthand = await resolver.compile(new Schema('any').validator({'$has-prefix': 'http'}));
    assert.strictEqual(await shorthand.validateValue('http://example.com'), 'http://example.com');
  });

  it('should throw for values that do not start with the required prefix', async function() {
    const schema = await resolver.compile(new Schema('any').validator({'$has-prefix': {match: 'http'}}));

    await assert.rejects(() => schema.validateValue('ftp://example.com'), ValidationError);
    await assert.rejects(() => schema.validateValue('HTTP://example.com'), ValidationError); // case-sensitive
    await assert.rejects(() => schema.validateValue(''), ValidationError);
    await assert.rejects(() => schema.validateValue('example.com'), ValidationError);
  });
});
