
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';
import { EMPTY } from '../src/schema/constants.js';

describe('Processor: $array', function() {
  /** @type {SchemaResolver} */
  let resolver;
  /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
  let schema;

  beforeEach(async function() {
    resolver = new SchemaResolver();
    schema = await resolver.compile(new Schema('any').transformer('$array'));
  });

  it('should convert EMPTY to an empty array', async function() {
    assert.deepStrictEqual(await schema.transformValue(EMPTY), []);
  });

  it('should pass through plain arrays unchanged', async function() {
    assert.deepStrictEqual(await schema.transformValue([1, 2, 3]), [1, 2, 3]);
    assert.deepStrictEqual(await schema.transformValue([]), []);
  });

  it('should split a comma-separated string into trimmed elements', async function() {
    assert.deepStrictEqual(await schema.transformValue('a,b,c'), ['a', 'b', 'c']);
    assert.deepStrictEqual(await schema.transformValue('x , y , z'), ['x', 'y', 'z']);
    assert.deepStrictEqual(await schema.transformValue(''), []);
  });

  it('should parse a JSON array string', async function() {
    assert.deepStrictEqual(await schema.transformValue('[1,2,3]'), [1, 2, 3]);
    assert.deepStrictEqual(await schema.transformValue('[]'), []);
    assert.deepStrictEqual(await schema.transformValue('["a","b"]'), ['a', 'b']);
  });

  it('should restore circular references from a $string round-trip', async function() {
    // This exercises resolvePath / parsePath / setPath in stringify.js via the array path
    const stringSchema = await resolver.compile(new Schema('any').transformer('$string'));
    const arr = [1, 2];
    arr.push(arr); // arr[2] === arr
    const json = await stringSchema.transformValue(arr);
    const result = await schema.transformValue(json);
    assert.strictEqual(result[0], 1);
    assert.strictEqual(result[2], result, 'circular reference should be restored');
  });

  it('should throw for an unparseable bracket string', async function() {
    await assert.rejects(() => schema.transformValue('[bad]'), TransformError);
  });

  it('should throw for non-array, non-string inputs', async function() {
    await assert.rejects(() => schema.transformValue(42), TransformError);
    await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
  });
});
