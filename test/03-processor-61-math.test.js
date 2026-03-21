
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processors: $abs, $pow, $sqrt, $clamp', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  // ─── $abs ──────────────────────────────────────────────────────────────────

  describe('$abs', function() {

    it('should return absolute value of a number', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$abs'));
      assert.strictEqual(await schema.transformValue(-5), 5);
      assert.strictEqual(await schema.transformValue(3.14), 3.14);
      assert.strictEqual(await schema.transformValue(0), 0);
      assert.strictEqual(await schema.transformValue(42), 42);
    });

    it('should throw TransformError for non-number inputs', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$abs'));
      await assert.rejects(() => schema.transformValue('5'), TransformError);
      await assert.rejects(() => schema.transformValue([1, 2]), TransformError);
    });
  });

  // ─── $pow ──────────────────────────────────────────────────────────────────

  describe('$pow', function() {

    it('should raise input to a power', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$pow: 3}));
      assert.strictEqual(await schema.transformValue(2), 8);
      assert.strictEqual(await schema.transformValue(10), 1000);
    });

    it('should raise a fixed base to a fixed exponent (ignoring input)', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$pow: {exponent: 8, base: 2}}));
      assert.strictEqual(await schema.transformValue('anything'), 256);
    });

    it('should throw SchemaError at compile time if arg is missing', async function() {
      await assert.rejects(
        () => resolver.compile(new Schema('any').transformer('$pow')),
        SchemaError
      );
    });

    it('should throw TransformError for non-number input as base', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$pow: 2}));
      await assert.rejects(() => schema.transformValue('hello'), TransformError);
    });
  });

  // ─── $sqrt ─────────────────────────────────────────────────────────────────

  describe('$sqrt', function() {

    it('should return square root of a number', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$sqrt'));
      assert.strictEqual(await schema.transformValue(9), 3);
      assert.strictEqual(await schema.transformValue(4), 2);
      assert.strictEqual(await schema.transformValue(0), 0);
    });

    it('should throw TransformError for negative numbers and non-numbers', async function() {
      const schema = await resolver.compile(new Schema('any').transformer('$sqrt'));
      await assert.rejects(() => schema.transformValue(-1), TransformError);
      await assert.rejects(() => schema.transformValue('9'), TransformError);
    });
  });

  // ─── $clamp ────────────────────────────────────────────────────────────────

  describe('$clamp', function() {

    it('should clamp value between min and max', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$clamp: {min: 0, max: 100}}));
      assert.strictEqual(await schema.transformValue(-5), 0);
      assert.strictEqual(await schema.transformValue(150), 100);
      assert.strictEqual(await schema.transformValue(42), 42);
    });

    it('should clamp only the floor when max is omitted', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$clamp: {min: 0}}));
      assert.strictEqual(await schema.transformValue(-10), 0);
      assert.strictEqual(await schema.transformValue(9999), 9999);
    });

    it('should clamp only the ceiling when min is omitted', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$clamp: {max: 255}}));
      assert.strictEqual(await schema.transformValue(300), 255);
      assert.strictEqual(await schema.transformValue(-999), -999);
    });

    it('should throw TransformError for non-number values', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$clamp: {min: 0, max: 100}}));
      await assert.rejects(() => schema.transformValue('50'), TransformError);
    });
  });
});
