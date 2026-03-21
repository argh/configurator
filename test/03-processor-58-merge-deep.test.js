
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $merge-deep', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$merge-deep')),
      SchemaError
    );
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({'$merge-deep': [1, 2]})),
      SchemaError
    );
  });

  it('should shallow-merge top-level fields (same as $merge)', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$merge-deep': {b: 99, c: 3}})
    );
    assert.deepStrictEqual(
      await schema.transformValue({a: 1, b: 2}),
      {a: 1, b: 99, c: 3}
    );
  });

  it('should recursively merge nested objects instead of replacing them', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$merge-deep': {a: {y: 99, z: 3}}})
    );
    assert.deepStrictEqual(
      await schema.transformValue({a: {x: 1, y: 2}}),
      {a: {x: 1, y: 99, z: 3}}
    );
  });

  it('should overwrite arrays rather than merging them', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$merge-deep': {tags: ['b', 'c']}})
    );
    assert.deepStrictEqual(
      await schema.transformValue({tags: ['a']}),
      {tags: ['b', 'c']}
    );
  });

  it('should not mutate the input object', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$merge-deep': {a: {z: 99}}})
    );
    const input = {a: {x: 1}};
    await schema.transformValue(input);
    assert.deepStrictEqual(input, {a: {x: 1}});
  });

  it('should throw for non-object inputs', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({'$merge-deep': {a: 1}})
    );
    await assert.rejects(() => schema.transformValue('string'), TransformError);
    await assert.rejects(() => schema.transformValue([1, 2, 3]), TransformError);
    await assert.rejects(() => schema.transformValue(42), TransformError);
  });
});
