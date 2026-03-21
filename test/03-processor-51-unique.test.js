
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $unique', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should deduplicate numbers', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$unique'));
    assert.deepStrictEqual(await schema.transformValue([1, 2, 1, 3, 2]), [1, 2, 3]);
  });

  it('should deduplicate strings', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$unique'));
    assert.deepStrictEqual(await schema.transformValue(['a', 'b', 'a', 'c']), ['a', 'b', 'c']);
  });

  it('should preserve insertion order of first occurrences', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$unique'));
    assert.deepStrictEqual(await schema.transformValue([3, 1, 2, 1, 3]), [3, 1, 2]);
  });

  it('should return an empty array unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$unique'));
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should throw for non-array inputs', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$unique'));
    await assert.rejects(() => schema.transformValue('hello'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
