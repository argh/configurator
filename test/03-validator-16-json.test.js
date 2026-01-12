
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
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('{"key":"value"}');
    await compiled._validateValue('{"a":1,"b":2}');
  });

  it('should accept valid JSON array', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('[1,2,3]');
    await compiled._validateValue('["a","b","c"]');
  });

  it('should accept JSON primitives', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await compiled._validateValue('null');
    await compiled._validateValue('true');
    await compiled._validateValue('123');
    await compiled._validateValue('"string"');
  });

  it('should reject invalid JSON', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled._validateValue('{invalid}'), ValidationError);
    await assert.rejects(() => compiled._validateValue("{'single':quotes}"), ValidationError);
    await assert.rejects(() => compiled._validateValue('{trailing:comma,}'), ValidationError);
  });
});
