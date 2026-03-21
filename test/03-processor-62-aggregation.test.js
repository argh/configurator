
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { TransformError } from '../src/schema/schema-errors.js';

describe('Processors: $sum, $min, $max', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  // ─── $sum ──────────────────────────────────────────────────────────────────

  describe('$sum', function() {

    it('should sum an array of numbers', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$sum'));
      assert.strictEqual(await schema.transformValue([1, 2, 3]), 6);
      assert.strictEqual(await schema.transformValue([10, -3, 0.5]), 7.5);
      assert.strictEqual(await schema.transformValue([]), 0);
    });

    it('should throw TransformError for non-array input or non-number elements', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$sum'));
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue([1, 'two', 3]), TransformError);
    });
  });

  // ─── $min ──────────────────────────────────────────────────────────────────

  describe('$min', function() {

    it('should return the minimum value from an array', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$min'));
      assert.strictEqual(await schema.transformValue([3, 1, 2]), 1);
      assert.strictEqual(await schema.transformValue([-5, 0, 5]), -5);
      assert.strictEqual(await schema.transformValue([42]), 42);
    });

    it('should return undefined for an empty array', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$min'));
      assert.strictEqual(await schema.transformValue([]), undefined);
    });

    it('should throw TransformError for non-array input or non-number elements', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$min'));
      await assert.rejects(() => schema.transformValue('hello'), TransformError);
      await assert.rejects(() => schema.transformValue([1, 'x', 3]), TransformError);
    });
  });

  // ─── $max ──────────────────────────────────────────────────────────────────

  describe('$max', function() {

    it('should return the maximum value from an array', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$max'));
      assert.strictEqual(await schema.transformValue([3, 1, 2]), 3);
      assert.strictEqual(await schema.transformValue([-5, 0, 5]), 5);
      assert.strictEqual(await schema.transformValue([42]), 42);
    });

    it('should return undefined for an empty array', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$max'));
      assert.strictEqual(await schema.transformValue([]), undefined);
    });

    it('should throw TransformError for non-array input or non-number elements', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$max'));
      await assert.rejects(() => schema.transformValue({a: 1}), TransformError);
      await assert.rejects(() => schema.transformValue([1, NaN, 3]), TransformError);
    });
  });
});
