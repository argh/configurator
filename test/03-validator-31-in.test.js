
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Validator: in', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should accept value in array', async function() {
    const schema = new Schema('string').validator({$in: ['red', 'green', 'blue']});
    const compiled = await resolver.compile(schema);

    await compiled.validate('red', {}, '');
    await compiled.validate('green', {}, '');
    await compiled.validate('blue', {}, '');
  });

  it('should reject value not in array', async function() {
    const schema = new Schema('string').validator({$in: ['red', 'green', 'blue']});
    const compiled = await resolver.compile(schema);

    await assert.rejects(() => compiled.validate('yellow', {}, ''), ValidationError);
  });

  it('should work with numbers', async function() {
    const schema = new Schema('number').validator({$in: [1, 2, 3, 5, 8, 13]});
    const compiled = await resolver.compile(schema);

    await compiled.validate(1, {}, '');
    await compiled.validate(13, {}, '');
    await assert.rejects(() => compiled.validate(4, {}, ''), ValidationError);
  });

  it('should work with mixed types', async function() {
    const schema = new Schema('any').validator({$in: ['yes', 'no', 1, 0]});
    const compiled = await resolver.compile(schema);

    await compiled.validate('yes', {}, '');
    await compiled.validate(1, {}, '');
    await assert.rejects(() => compiled.validate('maybe', {}, ''), ValidationError);
  });

  it('should generate description', async function() {
    const schema = new Schema('string').validator({$in: ['a', 'b', 'c']});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[a|b|c]');
  });

  it('should handle non-string values in description', async function() {
    const schema = new Schema('number').validator({$in: [1, 2, 3]});
    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.metadata.valueDescription, '[1|2|3]');
  });
});