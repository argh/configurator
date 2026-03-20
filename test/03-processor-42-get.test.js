
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: $get', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject missing path at compile time', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$get')),
      SchemaError
    );
  });

  it('should extract a value by dot-path from a nested object', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$get: {path: 'fruit.name'}})
    );
    assert.strictEqual(
      await schema.transformValue({fruit: {name: 'apple', color: 'red'}}),
      'apple'
    );
    // missing path returns undefined (does not throw)
    assert.strictEqual(
      await schema.transformValue({vegetable: 'carrot'}),
      undefined
    );
  });

  it('should extract a value by numeric index from an array', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$get: {path: 1}})
    );
    assert.strictEqual(await schema.transformValue(['apple', 'banana', 'cherry']), 'banana');
    // non-array with numeric path returns undefined
    assert.strictEqual(await schema.transformValue({fruit: 'apple'}), undefined);
  });
});
