
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: floor', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$floor: {unexpected: 0}})),
      SchemaError
    );
  });

  it('should floor numeric values to integer by default', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$floor'));

    assert.strictEqual(await schema.transformValue(3.7), 3);
    assert.strictEqual(await schema.transformValue(9.99), 9);
    assert.strictEqual(await schema.transformValue(-2.3), -3);   // floor rounds toward -Infinity
    assert.strictEqual(await schema.transformValue(5.0), 5);
    assert.strictEqual(await schema.transformValue(0.1), 0);
  });

  it('should floor to the specified decimal precision', async function() {
    const p2 = await resolver.compile(new Schema('any').transformer({$floor: {precision: 2}}));
    assert.strictEqual(await p2.transformValue(3.14159), 3.14);
    assert.strictEqual(await p2.transformValue(99.999), 99.99);
    assert.strictEqual(await p2.transformValue(-2.345), -2.35);  // floor at 2dp

    const p1 = await resolver.compile(new Schema('any').transformer({$floor: {precision: 1}}));
    assert.strictEqual(await p1.transformValue(3.76), 3.7);
  });

  it('should pass through non-numeric values unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$floor'));

    assert.strictEqual(await schema.transformValue('not a number'), 'not a number');
    assert.strictEqual(await schema.transformValue(null), null);
    assert.strictEqual(await schema.transformValue(undefined), undefined);
  });
});
