
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $merge', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // array arg is not valid (must be an object)
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$merge: ['apple', 'banana']})),
      SchemaError
    );
  });

  it('should merge the argument fields over the input object', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$merge: {banana: 99, cherry: 3}})
    );
    // arg fields override conflicts; non-conflicting input fields are preserved
    assert.deepStrictEqual(
      await schema.transformValue({apple: 1, banana: 2}),
      {apple: 1, banana: 99, cherry: 3}
    );
    // merging into an empty object
    assert.deepStrictEqual(
      await schema.transformValue({}),
      {banana: 99, cherry: 3}
    );
  });

  it('should not mutate the input object', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$merge: {banana: 99}})
    );
    const input = {apple: 1, banana: 2};
    await schema.transformValue(input);
    assert.strictEqual(input.banana, 2);
  });

  it('should throw for non-object inputs', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$merge: {cherry: 3}})
    );
    await assert.rejects(() => schema.transformValue([1, 2]), TransformError);
    await assert.rejects(() => schema.transformValue('apple'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});
