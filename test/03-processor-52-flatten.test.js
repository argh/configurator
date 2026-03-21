
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $flatten', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should flatten one level by default', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$flatten'));
    assert.deepStrictEqual(await schema.transformValue([[1, 2], [3, [4]]]), [1, 2, 3, [4]]);
  });

  it('should flatten to the specified depth', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$flatten: {depth: 2}}));
    assert.deepStrictEqual(await schema.transformValue([[1, [2, [3]]]]), [1, 2, [3]]);
  });

  it('should flatten completely with Infinity depth', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$flatten: {depth: Infinity}}));
    assert.deepStrictEqual(await schema.transformValue([[1, [2, [3, [4]]]]]), [1, 2, 3, 4]);
  });

  it('should leave a non-nested array unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$flatten'));
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), [1, 2, 3]);
  });

  it('should return an empty array unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$flatten'));
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should throw for non-array inputs', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$flatten'));
    await assert.rejects(() => schema.transformValue('hello'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
