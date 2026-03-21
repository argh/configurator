
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $group-by', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should group array elements by a named property', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({'$group-by': 'type'}));
    const result = await schema.transformValue([
      {type: 'fruit', name: 'apple'},
      {type: 'veg', name: 'carrot'},
      {type: 'fruit', name: 'banana'},
    ]);
    assert.deepStrictEqual(result, {
      fruit: [{type: 'fruit', name: 'apple'}, {type: 'fruit', name: 'banana'}],
      veg:   [{type: 'veg',   name: 'carrot'}],
    });
  });

  it('should omit elements where the group key is undefined (missing property)', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({'$group-by': 'type'}));
    const result = await schema.transformValue([
      {type: 'fruit', name: 'apple'},
      {name: 'mystery'},           // no type key → undefined → omitted
    ]);
    assert.deepStrictEqual(result, {
      fruit: [{type: 'fruit', name: 'apple'}],
    });
  });

  it('should group by a processor that extracts the key', async function() {
    // Use $type as the key extractor: groups elements by their JS type name
    const schema = await resolver.compile(new Schema('any').transformer({'$group-by': '$type'}));
    const result = await schema.transformValue([1, 'a', 2, 'b', true]);
    assert.deepStrictEqual(result, {
      number:  [1, 2],
      string:  ['a', 'b'],
      boolean: [true],
    });
  });

  it('should return an empty object for an empty array', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({'$group-by': 'type'}));
    assert.deepStrictEqual(await schema.transformValue([]), {});
  });

  it('should throw SchemaError at compile time if argument is missing', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$group-by')),
      SchemaError
    );
  });

  it('should throw TransformError for non-array input', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({'$group-by': 'key'}));
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });

});

