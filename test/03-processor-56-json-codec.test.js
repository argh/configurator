
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $json-encode / $json-decode', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('$json-encode', function() {
    it('should serialize values to compact JSON by default', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$json-encode'));
      assert.strictEqual(await schema.transformValue({a: 1, b: [2, 3]}), '{"a":1,"b":[2,3]}');
      assert.strictEqual(await schema.transformValue([1, 'two', null]), '[1,"two",null]');
      assert.strictEqual(await schema.transformValue(42), '42');
      assert.strictEqual(await schema.transformValue('hello'), '"hello"');
    });

    it('should pretty-print when indent is specified', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({'$json-encode': {indent: 2}})
      );
      assert.strictEqual(
        await schema.transformValue({a: 1}),
        '{\n  "a": 1\n}'
      );
    });

    it('should round-trip with $json-decode', async function() {
      const encode = await resolver.compile(new Schema('any').transformer('$json-encode'));
      const decode = await resolver.compile(new Schema('any').transformer('$json-decode'));
      const original = {x: [1, 2, 3], y: 'hello', z: null};
      const encoded = await encode.transformValue(original);
      assert.deepStrictEqual(await decode.transformValue(encoded), original);
    });
  });

  describe('$json-decode', function() {
    it('should parse valid JSON strings', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$json-decode'));
      assert.deepStrictEqual(await schema.transformValue('{"a":1}'), {a: 1});
      assert.deepStrictEqual(await schema.transformValue('[1,2,3]'), [1, 2, 3]);
      assert.strictEqual(await schema.transformValue('42'), 42);
      assert.strictEqual(await schema.transformValue('"hello"'), 'hello');
      assert.strictEqual(await schema.transformValue('null'), null);
    });

    it('should throw for invalid JSON', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$json-decode'));
      await assert.rejects(() => schema.transformValue('{bad json}'), TransformError);
      await assert.rejects(() => schema.transformValue('undefined'), TransformError);
    });

    it('should throw for non-string inputs', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$json-decode'));
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
    });
  });
});
