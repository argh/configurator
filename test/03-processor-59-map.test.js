
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $map', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should map over array elements', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$map': '$string'})
    );
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), ['1', '2', '3']);
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should map over object values, preserving keys', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$map': '$string'})
    );
    assert.deepStrictEqual(
      await schema.transformValue({a: 1, b: 2, c: 3}),
      {a: '1', b: '2', c: '3'}
    );
  });

  it('should produce undefined in output when processor returns undefined', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$map': (v) => typeof v === 'number' && v % 2 !== 0 ? v * 10 : undefined})
    );
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3, 4]), [10, undefined, 30, undefined]);
    assert.deepStrictEqual(
      await schema.transformValue({odd: 1, even: 2}),
      {odd: 10, even: undefined}
    );
  });

  it('should act as identity with no processor argument', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer('$map')
    );
    assert.deepStrictEqual(await schema.transformValue([1, 'two', 3]), [1, 'two', 3]);
    assert.deepStrictEqual(await schema.transformValue({a: 1}), {a: 1});
  });

  it('should not mutate the input array or object', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$map': '$string'})
    );
    const arr = [1, 2, 3];
    await schema.transformValue(arr);
    assert.deepStrictEqual(arr, [1, 2, 3]);

    const obj = {a: 1, b: 2};
    await schema.transformValue(obj);
    assert.deepStrictEqual(obj, {a: 1, b: 2});
  });

  it('should throw for non-collection inputs', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$map': '$string'})
    );
    await assert.rejects(() => schema.transformValue('a string'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});
