
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { NormalizeError, TransformError, ValidationError } from '../src/schema/schema-errors.js';

/**
 * Integration tests: full pipeline processing (.process()) across multiple phases.
 * These tests intentionally cross phase boundaries to verify composed behaviors.
 */
describe('Process - Integration', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  /**
   * Scenario: ISO date string → structured object → reformatted output.
   *
   * Normalizer:  $match parses the string into named groups {year, month, day}
   * Properties:  each field is individually coerced to an integer
   * Transformer: $template reassembles the parts in a different locale format
   */
  describe('$match → properties → $template pipeline', function() {

    /** @type {import('../src/schema/compiled-schema.js').CompiledSchema} */
    let schema;

    beforeEach(async function() {
      schema = await resolver.compile(
        new Schema('any')
          .normalizer({$gate: ['$is-object', v => v, {$match: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/}]})
          .property('year',  new Schema('number').normalizer('$integer'))
          .property('month', new Schema('number').normalizer('$integer'))
          .property('day',   new Schema('number').normalizer('$integer'))
          .transformer({$template: '{month}/{day}/{year}'})
          .opaque()
      );
    });

    it('should parse an ISO date string and reformat as M/D/YYYY', async function() {
      assert.strictEqual(await schema.process('2026-03-21'), '3/21/2026');
      assert.strictEqual(await schema.process('2000-01-09'), '1/9/2000');
    });

    it('should work when the input is already the named-group object', async function() {
      // $gate: $is-object succeeds → identity → object used directly as input for property processing
      assert.strictEqual(
        await schema.process({year: 2026, month: 3, day: 21}),
        '3/21/2026'
      );
    });

    it('should return undefined when the string does not match the pattern', async function() {
      // $match returns undefined on no match → whole pipeline produces undefined
      const result = await schema.process('not-a-date');
      assert.strictEqual(result, undefined);
    });

    it('should carry leading-zero strings through integer coercion', async function() {
      // '03' → 3, so template should emit '3' not '03'
      const result = await schema.process('2026-03-07');
      assert.strictEqual(result, '3/7/2026');
    });
  });

  /**
   * Scenario: $template brace escaping and missing-key handling.
   */
  describe('$template edge cases', function() {

    it('should render an empty string for unknown keys', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$template: 'Hello, {name}! You are {age} years old.'})
      );
      assert.strictEqual(
        await schema.transformValue({name: 'Alice'}),
        'Hello, Alice! You are  years old.'
      );
    });

    it('should escape {{ and }} to literal braces', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$template: '{{literal}} {value}'})
      );
      assert.strictEqual(await schema.transformValue({value: 'x'}), '{literal} x');
    });

    it('should throw when applied to a non-object', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$template: '{x}'})
      );
      await assert.rejects(() => schema.transformValue('a string'), TransformError);
    });
  });
});
