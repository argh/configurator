
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: split', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$split: {unexpected: ','}})),
      SchemaError
    );
  });

  it('should split a string into an array', async function() {
    // default separator is ','
    const bare = await resolver.compile(new Schema('any').transformer('$split'));
    assert.deepStrictEqual(await bare.transformValue('a,b,c'), ['a', 'b', 'c']);
    assert.deepStrictEqual(await bare.transformValue('a'), ['a']);
    assert.deepStrictEqual(await bare.transformValue(''), ['']);

    // explicit separator
    const piped = await resolver.compile(new Schema('any').transformer({$split: {separator: '|'}}));
    assert.deepStrictEqual(await piped.transformValue('x|y|z'), ['x', 'y', 'z']);

    // space separator
    const spaced = await resolver.compile(new Schema('any').transformer({$split: {separator: ' '}}));
    assert.deepStrictEqual(await spaced.transformValue('hello world'), ['hello', 'world']);
  });

  it('should respect the limit parameter', async function() {
    const schema = await resolver.compile(
      new Schema('any').transformer({$split: {separator: ',', limit: 2}})
    );

    assert.deepStrictEqual(await schema.transformValue('a,b,c,d'), ['a', 'b']);
    assert.deepStrictEqual(await schema.transformValue('a,b'), ['a', 'b']);
    assert.deepStrictEqual(await schema.transformValue('a'), ['a']);
  });

  it('should stringify non-string input before splitting', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$split'));

    // number stringified before split
    assert.deepStrictEqual(await schema.transformValue(123), ['123']); // no comma, single element

    // array stringified (commas become split points with default separator)
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), ['1', '2', '3']); // "1,2,3".split(',')
  });
});
