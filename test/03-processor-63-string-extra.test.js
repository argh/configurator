
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processors: $replace, $substring, $pad', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  // ─── $replace ──────────────────────────────────────────────────────────────

  describe('$replace', function() {

    it('should replace all occurrences of a string pattern', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$replace: ['foo', 'baz']}));
      assert.strictEqual(await schema.transformValue('foo bar foo'), 'baz bar baz');
      assert.strictEqual(await schema.transformValue('no match here'), 'no match here');
    });

    it('should replace using a RegExp (flags control global)', async function() {
      const schemaGlobal = await resolver.compile(new Schema('any').transformer({$replace: [/foo/g, 'baz']}));
      assert.strictEqual(await schemaGlobal.transformValue('foo bar foo'), 'baz bar baz');

      const schemaFirst = await resolver.compile(new Schema('any').transformer({$replace: [/foo/, 'baz']}));
      assert.strictEqual(await schemaFirst.transformValue('foo bar foo'), 'baz bar foo');
    });

    it('should throw SchemaError at compile time for invalid arguments', async function() {
      await assert.rejects(
        () => resolver.compile(new Schema('any').transformer('$replace')),
        SchemaError
      );
      await assert.rejects(
        () => resolver.compile(new Schema('any').transformer({$replace: ['only-one']})),
        SchemaError
      );
    });

    it('should throw TransformError for non-string input', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$replace: ['x', 'y']}));
      await assert.rejects(() => schema.transformValue(42), TransformError);
    });
  });

  // ─── $substring ────────────────────────────────────────────────────────────

  describe('$substring', function() {

    it('should extract from start index to end of string', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$substring: 6}));
      assert.strictEqual(await schema.transformValue('hello world'), 'world');
      assert.strictEqual(await schema.transformValue('abcdef'), '');
    });

    it('should extract a fixed length from start index', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$substring: {start: 0, length: 5}})
      );
      assert.strictEqual(await schema.transformValue('hello world'), 'hello');
      assert.strictEqual(await schema.transformValue('hi'), 'hi'); // shorter than length
    });

    it('should throw TransformError for non-string input', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$substring: 0}));
      await assert.rejects(() => schema.transformValue(42), TransformError);
    });
  });

  // ─── $pad ──────────────────────────────────────────────────────────────────

  describe('$pad', function() {

    it('should left-pad a string by default', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$pad: {width: 5}}));
      assert.strictEqual(await schema.transformValue('42'), '   42');
      assert.strictEqual(await schema.transformValue('hello'), 'hello'); // already at width
      assert.strictEqual(await schema.transformValue('toolong'), 'toolong'); // longer than width
    });

    it('should right-pad when side is right', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$pad: {width: 5, char: '-', side: 'right'}})
      );
      assert.strictEqual(await schema.transformValue('hi'), 'hi---');
    });

    it('should use a custom pad character', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$pad: {width: 4, char: '0'}})
      );
      assert.strictEqual(await schema.transformValue('7'), '0007');
    });

    it('should throw TransformError for non-string input', async function() {
      const schema = await resolver.compile(new Schema('any').transformer({$pad: {width: 5}}));
      await assert.rejects(() => schema.transformValue(42), TransformError);
    });
  });
});
