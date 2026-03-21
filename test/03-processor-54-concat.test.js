
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $concat', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject empty args at compile time', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$concat: []})),
      SchemaError
    );
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$concat')),
      SchemaError
    );
  });

  it('should append a single item', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$concat: [4]}));
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), [1, 2, 3, 4]);
  });

  it('should append multiple items', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$concat: [4, 5, 6]}));
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), [1, 2, 3, 4, 5, 6]);
  });

  it('should work with an empty input array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$concat: [1, 2]}));
    assert.deepStrictEqual(await schema.transformValue([]), [1, 2]);
  });

  it('should append strings', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$concat: ['c', 'd']}));
    assert.deepStrictEqual(await schema.transformValue(['a', 'b']), ['a', 'b', 'c', 'd']);
  });

  it('should throw for non-array input', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({$concat: [1]}));
    await assert.rejects(() => schema.transformValue('hello'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
