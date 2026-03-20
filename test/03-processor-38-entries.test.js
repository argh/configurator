
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError, NormalizeError } from '../src/schema/schema-errors.js';

describe('Processor: $entries', function() {
  /** @type {SchemaResolver} */
  let resolver;
  /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
  let schema;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    schema = await resolver.compile(new Schema('any').transformer('$entries'));
  });

  it('should return [key, value] pairs for a plain object', async function() {
    assert.deepStrictEqual(
      await schema.transformValue({apple: 1, banana: 2}),
      [['apple', 1], ['banana', 2]]
    );
    assert.deepStrictEqual(await schema.transformValue({}), []);
  });

  it('should round-trip with $object to reconstruct the original object', async function() {
    const roundtrip = await resolver.compile(
      new Schema('any').transformer('$entries').transformer('$object')
    );
    const original = {apple: 1, banana: 2, cherry: 3};
    assert.deepStrictEqual(await roundtrip.transformValue(original), original);
  });

  it('should throw for non-object inputs', async function() {
    await assert.rejects(() => schema.transformValue([['a', 1]]), TransformError);
    await assert.rejects(() => schema.transformValue('apple'), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});

describe('Processor: $object entries reconstruction', function() {
  /** @type {SchemaResolver} */
  let resolver;
  /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
  let schema;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    schema = await resolver.compile(new Schema('any').normalizer('$object'));
  });

  it('should reconstruct a plain object from an entries array', async function() {
    assert.deepStrictEqual(
      await schema.normalizeValue([['apple', 1], ['banana', 2]]),
      {apple: 1, banana: 2}
    );
    assert.deepStrictEqual(await schema.normalizeValue([]), {});
  });
});
