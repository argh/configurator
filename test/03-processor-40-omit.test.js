
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $omit', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // empty array
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$omit: []})),
      SchemaError
    );
    // no argument at all
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$omit')),
      SchemaError
    );
  });

  it('should return the object with the specified keys removed', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$omit: ['banana']})
    );
    assert.deepStrictEqual(
      await schema.transformValue({apple: 1, banana: 2, cherry: 3}),
      {apple: 1, cherry: 3}
    );
    // keys absent from input are silently ignored
    assert.deepStrictEqual(
      await schema.transformValue({apple: 1}),
      {apple: 1}
    );
    // omit all keys
    const omitAll = await resolver.compile(
      new Schema('any').transformer({$omit: ['apple', 'banana']})
    );
    assert.deepStrictEqual(await omitAll.transformValue({apple: 1, banana: 2}), {});
  });

  it('should return a dense array with the specified indices removed', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$omit: [1]})
    );
    assert.deepStrictEqual(await schema.transformValue([10, 20, 30]), [10, 30]);
    // out-of-range indices are silently ignored
    assert.deepStrictEqual(await schema.transformValue([10]), [10]);
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should throw for non-object, non-array inputs', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$omit: ['banana']})
    );
    await assert.rejects(() => schema.transformValue('apple'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});
