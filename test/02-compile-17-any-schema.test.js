
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Schema: any — automatic container construction', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should return {} for true when any property key is a non-numeric string', async function() {
    const schema = await resolver.compile(
      new Schema('any').property('stringKey', new Schema())
    );
    assert.deepStrictEqual(await schema.normalizeValue(true), {});
  });

  it('should return [] for true when all property keys are numeric', async function() {
    const schema = await resolver.compile(
      new Schema('any').property('0', new Schema())
    );
    assert.deepStrictEqual(await schema.normalizeValue(true), []);
  });

  it('should return [] for true when the only property key is the wildcard *', async function() {
    const schema = await resolver.compile(
      new Schema('any').property('*', new Schema())
    );
    assert.deepStrictEqual(await schema.normalizeValue(true), []);
  });

  it('should return {} when mixed numeric and string keys are present', async function() {
    const schema = await resolver.compile(
      new Schema('any').property('0', new Schema()).property('name', new Schema())
    );
    assert.deepStrictEqual(await schema.normalizeValue(true), {});
  });

  it('should pass through non-true values unchanged', async function() {
    const schema = await resolver.compile(
      new Schema('any').property('name', new Schema())
    );
    assert.strictEqual(await schema.normalizeValue('hello'), 'hello');
    assert.strictEqual(await schema.normalizeValue(42), 42);
    assert.deepStrictEqual(await schema.normalizeValue({existing: 1}), {existing: 1});
    assert.deepStrictEqual(await schema.normalizeValue(false), false);
  });

  it('should pass through true unchanged when schema has no children', async function() {
    const schema = await resolver.compile(new Schema('any'));
    assert.strictEqual(await schema.normalizeValue(true), true);
  });
});
