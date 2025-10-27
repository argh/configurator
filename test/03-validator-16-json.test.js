
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: json', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept valid JSON object', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = resolver.compile(schema);

    await compiled.validate('{"key":"value"}', {}, '');
    await compiled.validate('{"a":1,"b":2}', {}, '');
  });

  it('should accept valid JSON array', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = resolver.compile(schema);

    await compiled.validate('[1,2,3]', {}, '');
    await compiled.validate('["a","b","c"]', {}, '');
  });

  it('should accept JSON primitives', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = resolver.compile(schema);

    await compiled.validate('null', {}, '');
    await compiled.validate('true', {}, '');
    await compiled.validate('123', {}, '');
    await compiled.validate('"string"', {}, '');
  });

  it('should reject invalid JSON', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = resolver.compile(schema);

    await assert.rejects(() => compiled.validate('{invalid}', {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate("{'single':quotes}", {}, ''), ValidationError);
    await assert.rejects(() => compiled.validate('{trailing:comma,}', {}, ''), ValidationError);
  });
});
