
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError, ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: $matches and $match', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  // ─── $matches ──────────────────────────────────────────────────────────────

  describe('$matches (constraint)', function() {

    it('should pass when value matches pattern', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$matches: /^\d{3}-\d{4}$/})
      );
      assert.strictEqual(await schema.validateValue('123-4567'), '123-4567');
    });

    it('should throw ConstraintError when value does not match', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$matches: /^\d+$/})
      );
      await assert.rejects(() => schema.validateValue('abc'), ValidationError);
    });

    it('should coerce value to string before testing', async function() {
      const schema = await resolver.compile(
        new Schema('any').validator({$matches: /^123$/})
      );
      assert.strictEqual(await schema.validateValue(123), 123);
    });

    it('should respect regex flags (case-insensitive)', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$matches: /^hello$/i})
      );
      assert.strictEqual(await schema.validateValue('HELLO'), 'HELLO');
      assert.strictEqual(await schema.validateValue('Hello'), 'Hello');
    });

    it('should accept a string-form regex pattern', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$matches: '/^\\d+$/'})
      );
      await schema.validateValue('42');
      await assert.rejects(() => schema.validateValue('abc'), ValidationError);
    });

    it('should throw SchemaError at compile time if argument is not a RegExp', async function() {
      await assert.rejects(
        () => resolver.compile(new Schema('string').validator({$matches: 'not-a-regex'})),
        SchemaError
      );
    });

    it('should expose the regex as its description', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$matches: /^[a-z]+$/})
      );
      assert.strictEqual(schema.metadata.valueDescription, '[/^[a-z]+$/]');
    });

    it('should compose inside $and', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$and: [{$matches: /^test/}, {$matches: /end$/}]})
      );
      await schema.validateValue('testend');
      await assert.rejects(() => schema.validateValue('testXX'), ValidationError);
    });

    it('should compose inside $not', async function() {
      const schema = await resolver.compile(
        new Schema('string').validator({$assert: {$not: {$matches: /^test/}}})
      );
      await schema.validateValue('other');
      await assert.rejects(() => schema.validateValue('test123'), ValidationError);
    });
  });

  // ─── $match ────────────────────────────────────────────────────────────────

  describe('$match (operator)', function() {

    it('should return positional capture groups as an array', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$match: /(\w+)\s(\w+)/})
      );
      const result = await schema.transformValue('hello world');
      assert.deepStrictEqual(result, ['hello world', 'hello', 'world']);
    });

    it('should return named capture groups as an object', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$match: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/})
      );
      const result = await schema.transformValue('2026-03-21');
      assert.deepStrictEqual(result, {year: '2026', month: '03', day: '21'});
    });

    it('should return undefined when there is no match', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$match: /^\d+$/})
      );
      const result = await schema.transformValue('abc');
      assert.strictEqual(result, undefined);
    });

    it('should throw for non-string inputs', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$match: /(\d+)/})
      );
      await assert.rejects(() => schema.transformValue(42), TransformError);
      await assert.rejects(() => schema.transformValue({x: 1}), TransformError);
    });

    it('should respect regex flags (case-insensitive)', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$match: /^(hello)$/i})
      );
      const result = await schema.transformValue('HELLO');
      assert.deepStrictEqual(result, ['HELLO', 'HELLO']);
    });

    it('should throw SchemaError at compile time if argument is not a RegExp', async function() {
      await assert.rejects(
        () => resolver.compile(new Schema('any').transformer({$match: 'not-a-regex'})),
        SchemaError
      );
    });

    it('should work in a pipeline to extract and transform', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer([
          {$match: /(?<year>\d{4})-(?<month>\d{2})/},
          {$get: 'year'}
        ])
      );
      const result = await schema.transformValue('2026-03');
      assert.strictEqual(result, '2026');
    });
  });
});
