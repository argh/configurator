
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

    await compiled.validateValue('{"key":"value"}');
    await compiled.validateValue('{"a":1,"b":2}');
  });

  it('should accept valid JSON array', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('[1,2,3]');
    await compiled.validateValue('["a","b","c"]');
  });

  it('should accept JSON primitives', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await compiled.validateValue('null');
    await compiled.validateValue('true');
    await compiled.validateValue('123');
    await compiled.validateValue('"string"');
  });

  it('should reject invalid JSON', async function() {
    const schema = new Schema('string').validator('$json');
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validateValue('{invalid}'), ValidationError);
    await assert.rejects(() => compiled.validateValue("{'single':quotes}"), ValidationError);
    await assert.rejects(() => compiled.validateValue('{trailing:comma,}'), ValidationError);
  });
});
