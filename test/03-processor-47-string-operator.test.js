
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Processor: $string', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should pass strings through unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$string'));
    assert.strictEqual(await schema.transformValue('hello'), 'hello');
    assert.strictEqual(await schema.transformValue(''), '');
  });

  it('should convert primitives via String()', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$string'));
    assert.strictEqual(await schema.transformValue(42), '42');
    assert.strictEqual(await schema.transformValue(3.14), '3.14');
    assert.strictEqual(await schema.transformValue(true), 'true');
    assert.strictEqual(await schema.transformValue(false), 'false');
  });

  it('should stringify plain objects to deterministic JSON', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$string'));
    const result = await schema.transformValue({b: 2, a: 1});
    // stringify sorts keys deterministically
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.a, 1);
    assert.strictEqual(parsed.b, 2);
  });

  it('should emit type markers for non-JSON-safe values inside objects', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$string'));

    const withNaN = await schema.transformValue({x: NaN});
    assert.ok(withNaN.includes('NaN'), `expected NaN marker in: ${withNaN}`);

    const withInf = await schema.transformValue({x: Infinity});
    assert.ok(withInf.includes('Infinity'), `expected Infinity marker in: ${withInf}`);
  });

  it('should emit a Circular marker for self-referential objects', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$string'));
    const obj = {a: 1};
    obj.self = obj;
    const result = await schema.transformValue(obj);
    // «Circular: $» — path is $ because obj was first seen at root
    assert.ok(result.includes('Circular'), `expected Circular marker in: ${result}`);
    assert.ok(result.includes('"self"'), `expected self key in: ${result}`);
  });
});
