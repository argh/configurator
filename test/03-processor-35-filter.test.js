
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: filter', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // too many positional args
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$filter: ['$positive', '$negative']})),
      SchemaError
    );
    // too many named args
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$filter: {processor: '$positive', extra: 'bad'}})),
      SchemaError
    );
  });

  it('should keep elements where the predicate succeeds, returning the processed value', async function() {
    // bare $filter removes null/undefined, keeps everything else as-is
    const bare = await resolver.compile(new Schema('any').transformer('$filter'));
    assert.deepStrictEqual(await bare.transformValue([1, null, 2, undefined, 3]), [1, 2, 3]);

    // predicate pipeline: processor output is kept, consistent with standard processor semantics
    // '1' → $number → 1 → $positive → 1 (kept as 1); '-2' and 'crow' fail → removed
    const numFilter = await resolver.compile(
      new Schema('any').transformer({$filter: {$pipeline: ['$number', '$positive']}})
    );
    assert.deepStrictEqual(await numFilter.transformValue(['1', '-2', '3', 'crow', '-4', '5']), [1, 3, 5]);

    // non-array input yields empty array (not an error)
    assert.deepStrictEqual(await numFilter.transformValue('not-an-array'), []);
  });

  it('should remove elements where the predicate throws or returns undefined', async function() {
    const numFilter = await resolver.compile(
      new Schema('any').transformer({$filter: {$pipeline: ['$number', '$positive']}})
    );

    // all elements fail — empty result
    assert.deepStrictEqual(await numFilter.transformValue(['-1', '-2', 'crow']), []);

    // mixed: only the passing elements survive, as their processed values
    assert.deepStrictEqual(await numFilter.transformValue(['-1', '5', 'crow', '10', '-3']), [5, 10]);
  });
});
