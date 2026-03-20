
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

/**
 * Compile a single-transformer schema for a keyword.
 * @param {SchemaResolver} resolver
 * @param {string} keyword
 * @returns {Promise<import('../src/schema/compiled-schema.js').CompiledSchema>}
 */
function compile(resolver, keyword) {
  return resolver.compile(new Schema('any').transformer(keyword));
}

describe('Processor: string formatter operators', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('$trim', function() {
    it('should strip leading and trailing whitespace', async function() {
      const schema = await compile(resolver, '$trim');
      assert.strictEqual(await schema.transformValue('  hello  '), 'hello');
      assert.strictEqual(await schema.transformValue('\t\nfoo\n'), 'foo');
      assert.strictEqual(await schema.transformValue('no-op'), 'no-op');
    });

    it('should coerce non-strings before trimming', async function() {
      const schema = await compile(resolver, '$trim');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$lowercase', function() {
    it('should convert to lower case', async function() {
      const schema = await compile(resolver, '$lowercase');
      assert.strictEqual(await schema.transformValue('Hello World'), 'hello world');
      assert.strictEqual(await schema.transformValue('FOO'), 'foo');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$lowercase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$uppercase', function() {
    it('should convert to upper case', async function() {
      const schema = await compile(resolver, '$uppercase');
      assert.strictEqual(await schema.transformValue('hello world'), 'HELLO WORLD');
      assert.strictEqual(await schema.transformValue('foo'), 'FOO');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$uppercase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$camelcase', function() {
    it('should convert word sequences to camelCase', async function() {
      const schema = await compile(resolver, '$camelcase');
      assert.strictEqual(await schema.transformValue('hello world'), 'helloWorld');
      assert.strictEqual(await schema.transformValue('foo-bar-baz'), 'fooBarBaz');
      assert.strictEqual(await schema.transformValue('FOO_BAR'), 'fooBar');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$camelcase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$pascalcase', function() {
    it('should convert word sequences to PascalCase', async function() {
      const schema = await compile(resolver, '$pascalcase');
      assert.strictEqual(await schema.transformValue('hello world'), 'HelloWorld');
      assert.strictEqual(await schema.transformValue('foo-bar-baz'), 'FooBarBaz');
      assert.strictEqual(await schema.transformValue('FOO_BAR'), 'FooBar');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$pascalcase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$kebabcase', function() {
    it('should convert word sequences to kebab-case', async function() {
      const schema = await compile(resolver, '$kebabcase');
      assert.strictEqual(await schema.transformValue('hello world'), 'hello-world');
      assert.strictEqual(await schema.transformValue('fooBarBaz'), 'foo-bar-baz');
      assert.strictEqual(await schema.transformValue('FOO_BAR'), 'foo-bar');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$kebabcase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$constantcase', function() {
    it('should convert word sequences to CONSTANT_CASE', async function() {
      const schema = await compile(resolver, '$constantcase');
      assert.strictEqual(await schema.transformValue('hello world'), 'HELLO_WORLD');
      assert.strictEqual(await schema.transformValue('fooBarBaz'), 'FOO_BAR_BAZ');
      assert.strictEqual(await schema.transformValue('foo-bar'), 'FOO_BAR');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$constantcase');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });

  describe('$headline', function() {
    it('should convert word sequences to Headline Case', async function() {
      const schema = await compile(resolver, '$headline');
      assert.strictEqual(await schema.transformValue('hello world'), 'Hello World');
      assert.strictEqual(await schema.transformValue('foo-bar-baz'), 'Foo Bar Baz');
      assert.strictEqual(await schema.transformValue('FOO_BAR'), 'Foo Bar');
    });

    it('should coerce non-strings', async function() {
      const schema = await compile(resolver, '$headline');
      assert.strictEqual(await schema.transformValue(42), '42');
    });
  });
});
