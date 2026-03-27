
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { NormalizeError } from '../src/schema/schema-errors.js';
import { EMPTY } from '../src/schema/constants.js';

describe('Processor: $object', function() {
  /** @type {SchemaResolver} */
  let resolver;
  /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
  let schema;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    schema = await resolver.compile(new Schema('any').normalizer('$object'));
  });

  it('should convert EMPTY to an empty object', async function() {
    assert.deepStrictEqual(await schema.normalizeValue(EMPTY), {});
  });

  it('should pass through plain objects unchanged', async function() {
    assert.deepStrictEqual(await schema.normalizeValue({a: 1}), {a: 1});
    assert.deepStrictEqual(await schema.normalizeValue({}), {});
  });

  it('should parse a plain JSON object string', async function() {
    assert.deepStrictEqual(await schema.normalizeValue('{"a":1,"b":2}'), {a: 1, b: 2});
  });

  it('should revive type markers produced by $string', async function() {
    // Round-trip: $string stringifies, $object parses back
    const stringSchema = await resolver.compile(new Schema('any').normalizer('$string'));
    const original = {n: NaN, i: Infinity};
    const json = await stringSchema.normalizeValue(original);
    const result = await schema.normalizeValue(json);
    assert.ok(Number.isNaN(result.n), 'NaN should be revived');
    assert.strictEqual(result.i, Infinity, 'Infinity should be revived');
  });

  it('should restore circular references from a $string round-trip', async function() {
    // This exercises resolvePath / parsePath / setPath in stringify.js
    const stringSchema = await resolver.compile(new Schema('any').normalizer('$string'));
    const obj = {a: 1};
    obj.self = obj;
    const json = await stringSchema.normalizeValue(obj);
    const result = await schema.normalizeValue(json);
    assert.strictEqual(result.a, 1);
    assert.strictEqual(result.self, result, 'circular reference should be restored');
  });

  it('should throw for an unparseable string', async function() {
    await assert.rejects(() => schema.normalizeValue('not json'), NormalizeError);
    await assert.rejects(() => schema.normalizeValue('{bad}'), NormalizeError);
  });

  it('should throw for non-object, non-string inputs', async function() {
    await assert.rejects(() => schema.normalizeValue(42), NormalizeError);
    await assert.rejects(() => schema.normalizeValue(false), NormalizeError);
  });
});
