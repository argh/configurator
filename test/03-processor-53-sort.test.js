
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $sort', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should sort numbers numerically (not lexicographic)', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$sort'));
    assert.deepStrictEqual(await schema.transformValue([10, 2, 1, 20]), [1, 2, 10, 20]);
  });

  it('should sort strings lexicographically', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$sort'));
    assert.deepStrictEqual(await schema.transformValue(['banana', 'apple', 'cherry']), ['apple', 'banana', 'cherry']);
  });

  it('should sort objects by a numeric key', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$sort: {key: 'age'}}));
    assert.deepStrictEqual(
      await schema.transformValue([{name: 'c', age: 30}, {name: 'a', age: 10}, {name: 'b', age: 20}]),
      [{name: 'a', age: 10}, {name: 'b', age: 20}, {name: 'c', age: 30}]
    );
  });

  it('should sort objects by a string key', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$sort: {key: 'name'}}));
    assert.deepStrictEqual(
      await schema.transformValue([{name: 'charlie'}, {name: 'alice'}, {name: 'bob'}]),
      [{name: 'alice'}, {name: 'bob'}, {name: 'charlie'}]
    );
  });

  it('should sort descending', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$sort: {direction: 'desc'}}));
    assert.deepStrictEqual(await schema.transformValue([1, 3, 2]), [3, 2, 1]);
  });

  it('should sort objects descending by key', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$sort: {key: 'age', direction: 'desc'}}));
    assert.deepStrictEqual(
      await schema.transformValue([{age: 10}, {age: 30}, {age: 20}]),
      [{age: 30}, {age: 20}, {age: 10}]
    );
  });

  it('should return an empty array unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$sort'));
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should not mutate the original array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$sort'));
    const input = [3, 1, 2];
    await schema.transformValue(input);
    assert.deepStrictEqual(input, [3, 1, 2]);
  });

  it('should throw for non-array inputs', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$sort'));
    await assert.rejects(() => schema.transformValue('hello'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
