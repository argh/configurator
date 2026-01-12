
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: numeric', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept positive integers', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    const result = await compiled._validateValue('12345');
    assert.strictEqual(result, '12345');
  });

  it('should accept zero', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('0');
  });

  it('should accept number with leading zeros', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('00123');
  });

  it('should reject negative numbers', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('-123'), ValidationError);
  });

  it('should reject decimals', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('123.45'), ValidationError);
  });

  it('should reject letters', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('123abc'), ValidationError);
  });

  it('should reject empty string', async function() {
    const schema = new Schema('string').validator('$numeric');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue(''), ValidationError);
  });
});
