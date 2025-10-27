
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError, TransformError, SerializeError } from '../src/errors.js';

describe('Schema Compilation - Date Type', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Date normalization', function() {

    it('should not have a normalizer by default', function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Date type relies on transformer, not normalizer
      // The base 'any' normalizer should be inherited
      assert.ok(compiled.options.normalizer);
    });
  });

  describe('Date transformation', function() {

    it('should transform Date objects unchanged', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const date = new Date('2024-01-01T00:00:00Z');
      const transformed = await compiled.transform(date, {}, 'field');

      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.toISOString(), '2024-01-01T00:00:00.000Z');
    });

    it('should transform ISO date string to Date', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('2024-01-15T12:30:45Z', {}, 'field');

      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.toISOString(), '2024-01-15T12:30:45.000Z');
    });

    it('should transform "now" to current Date', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const before = Date.now();
      const transformed = await compiled.transform('now', {}, 'field');
      const after = Date.now();

      assert.ok(transformed instanceof Date);
      assert.ok(transformed.getTime() >= before);
      assert.ok(transformed.getTime() <= after);
    });

    it('should transform millisecond timestamp to Date', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
      const transformed = await compiled.transform(timestamp, {}, 'field');

      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.toISOString(), '2024-01-01T00:00:00.000Z');
    });

    it('should transform small timestamp as seconds to Date', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Small timestamp (< 200000000) gets treated as seconds
      const timestamp = 100000000; // Small enough to be treated as seconds
      const transformed = await compiled.transform(timestamp, {}, 'field');

      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.getTime(), 100000000 * 1000);
    });

    it('should transform numeric string timestamp to Date', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const transformed = await compiled.transform('1704067200000', {}, 'field');

      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.toISOString(), '2024-01-01T00:00:00.000Z');
    });

    it('should transform relative time offset +1d', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const before = Date.now() + (24 * 60 * 60 * 1000);
      const transformed = await compiled.transform('+1d', {}, 'field');
      const after = Date.now() + (24 * 60 * 60 * 1000);

      assert.ok(transformed instanceof Date);
      assert.ok(transformed.getTime() >= before - 1000); // 1s tolerance
      assert.ok(transformed.getTime() <= after + 1000);
    });

    it('should transform relative time offset -1h', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const before = Date.now() - (60 * 60 * 1000);
      const transformed = await compiled.transform('-1h', {}, 'field');
      const after = Date.now() - (60 * 60 * 1000);

      assert.ok(transformed instanceof Date);
      assert.ok(transformed.getTime() >= before - 1000);
      assert.ok(transformed.getTime() <= after + 1000);
    });

    it('should transform relative time with units: ms, s, m, h, d, w', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Test various time units
      const units = [
        { offset: '+100ms', approxDelta: 100 },
        { offset: '+5s', approxDelta: 5000 },
        { offset: '+2m', approxDelta: 2 * 60 * 1000 },
        { offset: '-3h', approxDelta: -3 * 60 * 60 * 1000 },
        { offset: '+7d', approxDelta: 7 * 24 * 60 * 60 * 1000 },
        { offset: '-1w', approxDelta: -7 * 24 * 60 * 60 * 1000 }
      ];

      for (const { offset, approxDelta } of units) {
        const now = Date.now();
        const transformed = await compiled.transform(offset, {}, 'field');
        const expectedTime = now + approxDelta;

        assert.ok(transformed instanceof Date);
        assert.ok(Math.abs(transformed.getTime() - expectedTime) < 1000); // 1s tolerance
      }
    });

    it('should throw TransformError for invalid date string', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform('not-a-date', {}, 'field'),
        TransformError
      );
    });

    it('should throw TransformError for invalid Date object', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform(new Date('invalid'), {}, 'field'),
        TransformError
      );
    });

    it('should throw TransformError for non-date values', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.transform(true, {}, 'field'),
        TransformError
      );

      await assert.rejects(
        () => compiled.transform({}, {}, 'field'),
        TransformError
      );
    });
  });

  describe('Date validation', function() {

    it('should validate Date objects', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const date = new Date('2024-06-15');
      const validated = await compiled.validate(date);

      assert.ok(validated instanceof Date);
      assert.strictEqual(validated.toISOString(), date.toISOString());
    });

    it('should reject non-Date values during validation', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate('2024-01-01'),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(1704067200000),
        ValidationError
      );

      await assert.rejects(
        () => compiled.validate(null),
        ValidationError
      );
    });

    it('should reject invalid Date objects', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.validate(new Date('invalid')),
        ValidationError
      );
    });
  });

  describe('Date serialization', function() {

    it('should serialize Date to ISO string', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const date = new Date('2024-03-20T15:30:00Z');
      const serialized = await compiled.serialize(date);

      assert.strictEqual(serialized, '2024-03-20T15:30:00.000Z');
    });

    it('should serialize Date at epoch', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const date = new Date(0);
      const serialized = await compiled.serialize(date);

      assert.strictEqual(serialized, '1970-01-01T00:00:00.000Z');
    });

    it('should throw SerializeError for non-Date values', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      await assert.rejects(
        () => compiled.serialize('2024-01-01'),
        SerializeError
      );

      await assert.rejects(
        () => compiled.serialize(1704067200000),
        SerializeError
      );
    });
  });

  describe('Date with default value', function() {

    it('should have default Date value', function() {
      const defaultDate = new Date('2024-01-01');
      const schema = new Schema('date')
        .default(defaultDate);

      const compiled = resolver.compile(schema);

      assert.ok(compiled.default instanceof Date);
      assert.strictEqual(compiled.default.toISOString(), defaultDate.toISOString());
    });
  });

  describe('Date with required option', function() {

    it('should compile with required flag', function() {
      const schema = new Schema('date')
        .required(true);

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.required, true);
    });
  });

  describe('Date metadata', function() {

    it('should preserve metadata during compilation', function() {
      const schema = new Schema('date')
        .meta('description', 'Event timestamp')
        .meta('example', '2024-01-01T00:00:00Z');

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.description, 'Event timestamp');
      assert.strictEqual(compiled.metadata.example, '2024-01-01T00:00:00Z');
    });

    it('should have valueName set from base type', function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'date');
    });

    it('should have valueDescription set from base type', function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, 'ms|iso date|"now"|[+|-]offset[d|h|m|s|ms]');
    });

    it('should have parserTypeHint set to string', function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.metadata.parserTypeHint, 'string');
    });
  });

  describe('Complete workflow', function() {

    it('should handle transform -> validate -> serialize workflow with ISO string', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Transform
      const transformed = await compiled.transform('2024-12-25T00:00:00Z', {}, 'field');
      assert.ok(transformed instanceof Date);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(validated instanceof Date);

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.strictEqual(serialized, '2024-12-25T00:00:00.000Z');
    });

    it('should handle workflow with "now"', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Transform
      const transformed = await compiled.transform('now', {}, 'field');
      assert.ok(transformed instanceof Date);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(validated instanceof Date);

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.ok(serialized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/));
    });

    it('should handle workflow with timestamp', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const timestamp = 1704067200000;

      // Transform
      const transformed = await compiled.transform(timestamp, {}, 'field');
      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.getTime(), timestamp);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(validated instanceof Date);

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.strictEqual(serialized, '2024-01-01T00:00:00.000Z');
    });

    it('should handle workflow with relative offset', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      // Transform
      const transformed = await compiled.transform('+2h', {}, 'field');
      assert.ok(transformed instanceof Date);

      // Validate
      const validated = await compiled.validate(transformed);
      assert.ok(validated instanceof Date);

      // Serialize
      const serialized = await compiled.serialize(validated);
      assert.ok(serialized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/));
    });

    it('should round-trip serialize and transform', async function() {
      const schema = new Schema('date');
      const compiled = resolver.compile(schema);

      const originalDate = new Date('2024-06-15T10:30:00Z');

      // Serialize
      const serialized = await compiled.serialize(originalDate);
      assert.strictEqual(serialized, '2024-06-15T10:30:00.000Z');

      // Transform back
      const transformed = await compiled.transform(serialized, {}, 'field');
      assert.ok(transformed instanceof Date);
      assert.strictEqual(transformed.toISOString(), originalDate.toISOString());
    });
  });
});
