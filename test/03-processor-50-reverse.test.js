
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $reverse', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reverse a numeric array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$reverse'));
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), [3, 2, 1]);
    assert.deepStrictEqual(await schema.transformValue([10, 20]), [20, 10]);
  });

  it('should reverse a string array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$reverse'));
    assert.deepStrictEqual(await schema.transformValue(['a', 'b', 'c']), ['c', 'b', 'a']);
  });

  it('should return an empty array unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$reverse'));
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should not mutate the original array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$reverse'));
    const input = [1, 2, 3];
    await schema.transformValue(input);
    assert.deepStrictEqual(input, [1, 2, 3]);
  });

  it('should throw for non-array inputs', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$reverse'));
    await assert.rejects(() => schema.transformValue('hello'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
