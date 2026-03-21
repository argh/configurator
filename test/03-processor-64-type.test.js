
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Processor: $type', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should return the correct type name for each value type', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$type'));
    assert.strictEqual(await schema.transformValue('hello'), 'string');
    assert.strictEqual(await schema.transformValue(42), 'number');
    assert.strictEqual(await schema.transformValue(true), 'boolean');
    assert.strictEqual(await schema.transformValue([1, 2]), 'array');
    assert.strictEqual(await schema.transformValue({a: 1}), 'object');
    assert.strictEqual(await schema.transformValue(new Date()), 'date');
  });

  it('should distinguish array from object and date from object', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$type'));
    assert.notStrictEqual(await schema.transformValue([]), 'object');
    assert.notStrictEqual(await schema.transformValue(new Date()), 'object');
  });
});
