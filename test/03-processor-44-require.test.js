
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

/**
 * $require wraps a processor and enforces that it returns a defined value.
 * It throws a ConstraintError if the processor returns undefined or throws.
 * It passes through the original input on success (not the processed value).
 */
describe('Processor: require', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // too many positional args
    await assert.rejects(
      () => resolver.compile(new Schema('any').validator({$require: ['$numeric', '$alpha']})),
      SchemaError
    );
  });

  it('should pass through the input when the wrapped processor succeeds', async function() {
    // {$require: '$numeric'} succeeds when input passes $numeric
    const schema = await resolver.compile(new Schema('any').validator({$require: '$numeric'}));

    assert.strictEqual(await schema.validateValue('123'), '123');
    assert.strictEqual(await schema.validateValue('0'), '0');
    assert.strictEqual(await schema.validateValue('999'), '999');

    // $require passes through the original input, not the processed value
    const trimSchema = await resolver.compile(
      new Schema('any').validator({$require: {$pipeline: ['$trim', '$non-empty']}})
    );
    assert.strictEqual(await trimSchema.validateValue('  hello  '), '  hello  ');
  });

  it('should throw when the wrapped processor fails or returns undefined', async function() {
    const schema = await resolver.compile(new Schema('any').validator({$require: '$numeric'}));

    // $numeric throws ConstraintError for non-numeric → $require re-throws it
    await assert.rejects(() => schema.validateValue('abc'), ValidationError);
    await assert.rejects(() => schema.validateValue('12.34'), ValidationError);
    await assert.rejects(() => schema.validateValue(''), ValidationError);
  });
});
