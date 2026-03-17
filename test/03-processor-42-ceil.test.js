
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: ceil', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$ceil: {unexpected: 0}})),
      SchemaError
    );
  });

  it('should ceil numeric values to integer by default', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$ceil'));

    assert.strictEqual(await schema.transformValue(3.1), 4);
    assert.strictEqual(await schema.transformValue(3.0), 3);
    assert.strictEqual(await schema.transformValue(-2.3), -2);  // ceil rounds toward +Infinity
    assert.strictEqual(await schema.transformValue(0.01), 1);
    assert.strictEqual(await schema.transformValue(9.99), 10);
  });

  it('should ceil to the specified decimal precision', async function() {
    const p2 = await resolver.compile(new Schema('any').transformer({$ceil: {precision: 2}}));
    assert.strictEqual(await p2.transformValue(3.14159), 3.15);
    assert.strictEqual(await p2.transformValue(1.001), 1.01);
    assert.strictEqual(await p2.transformValue(5.0), 5);
    assert.strictEqual(await p2.transformValue(-2.341), -2.34);  // ceil at 2dp

    const p1 = await resolver.compile(new Schema('any').transformer({$ceil: {precision: 1}}));
    assert.strictEqual(await p1.transformValue(1.01), 1.1);
  });

  it('should pass through non-numeric values unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$ceil'));

    assert.strictEqual(await schema.transformValue('not a number'), 'not a number');
    assert.strictEqual(await schema.transformValue(null), null);
    assert.strictEqual(await schema.transformValue(undefined), undefined);
  });
});
