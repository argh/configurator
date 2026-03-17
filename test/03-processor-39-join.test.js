
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: join', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$join: {unexpected: ','}})),
      SchemaError
    );
  });

  it('should join array elements into a string', async function() {
    // default separator is ','
    const bare = await resolver.compile(new Schema('any').transformer('$join'));
    assert.strictEqual(await bare.transformValue(['a', 'b', 'c']), 'a,b,c');
    assert.strictEqual(await bare.transformValue([1, 2, 3]), '1,2,3');
    assert.strictEqual(await bare.transformValue([]), '');

    // explicit separator
    const piped = await resolver.compile(new Schema('any').transformer({$join: {separator: '|'}}));
    assert.strictEqual(await piped.transformValue(['x', 'y', 'z']), 'x|y|z');

    // space separator
    const spaced = await resolver.compile(new Schema('any').transformer({$join: {separator: ' '}}));
    assert.strictEqual(await spaced.transformValue(['hello', 'world']), 'hello world');

    // empty separator
    const empty = await resolver.compile(new Schema('any').transformer({$join: {separator: ''}}));
    assert.strictEqual(await empty.transformValue(['a', 'b', 'c']), 'abc');
  });

  it('should treat non-array input as a single element string', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$join'));

    // non-array is stringified directly (not wrapped in array)
    assert.strictEqual(await schema.transformValue('hello'), 'hello');
    assert.strictEqual(await schema.transformValue(42), '42');
  });
});
