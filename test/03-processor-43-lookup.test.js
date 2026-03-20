
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: $lookup', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // array arg is not valid (must be an object)
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$lookup: ['apple', 'banana']})),
      SchemaError
    );
  });

  it('should return the table value corresponding to the pipeline key', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$lookup: {apple: 1, banana: 2, cherry: 3}})
    );
    assert.strictEqual(await schema.transformValue('apple'), 1);
    assert.strictEqual(await schema.transformValue('cherry'), 3);
    // key not in table returns undefined (does not throw)
    assert.strictEqual(await schema.transformValue('grape'), undefined);
  });

  it('should work as a dispatch table in a pipeline', async function() {
    // Demonstrates the discriminator use case: extract a type key, look up a label
    const schema = await resolver.compile(
      new Schema('any')
        .transformer({$get: {path: 'type'}})
        .transformer({$lookup: {fruit: 'produce', meat: 'protein', grain: 'carb'}})
    );
    assert.strictEqual(await schema.transformValue({type: 'fruit', name: 'apple'}), 'produce');
    assert.strictEqual(await schema.transformValue({type: 'meat', name: 'chicken'}), 'protein');
    assert.strictEqual(await schema.transformValue({type: 'unknown'}), undefined);
  });
});
