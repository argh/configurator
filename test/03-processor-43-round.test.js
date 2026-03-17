
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

describe('Processor: round', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // unknown parameter
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$round: {unexpected: 0}})),
      SchemaError
    );
  });

  it('should round numeric values to integer by default', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$round'));

    assert.strictEqual(await schema.transformValue(3.7), 4);
    assert.strictEqual(await schema.transformValue(3.4), 3);
    assert.strictEqual(await schema.transformValue(3.5), 4);    // half rounds up
    assert.strictEqual(await schema.transformValue(-2.5), -2);  // Math.round(-2.5) = -2
    assert.strictEqual(await schema.transformValue(0.0), 0);
  });

  it('should round to the specified decimal precision', async function() {
    const p2 = await resolver.compile(new Schema('any').transformer({$round: {precision: 2}}));
    assert.strictEqual(await p2.transformValue(3.14159), 3.14);
    assert.strictEqual(await p2.transformValue(123.456), 123.46);
    assert.strictEqual(await p2.transformValue(5.0), 5);

    const p1 = await resolver.compile(new Schema('any').transformer({$round: {precision: 1}}));
    assert.strictEqual(await p1.transformValue(123.456), 123.5);
    assert.strictEqual(await p1.transformValue(1.04), 1.0);
  });

  it('should pass through non-numeric values unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$round'));

    assert.strictEqual(await schema.transformValue('not a number'), 'not a number');
    assert.strictEqual(await schema.transformValue(null), null);
    assert.strictEqual(await schema.transformValue(undefined), undefined);
  });
});
