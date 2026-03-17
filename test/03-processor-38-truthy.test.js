
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/schema/schema-errors.js';

/**
 * $truthy uses the library's extended notion of truthiness (isTruthy()), not JavaScript's.
 * Special human-friendly strings like "yes", "true", "on", "enabled" are truthy.
 * Special strings like "no", "false", "off", "disabled", "0", "" are falsey even though
 * they are non-empty strings (which would be truthy in standard JS).
 */
describe('Processor: truthy', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should pass through truthy values', async function() {
    const schema = await resolver.compile(new Schema('any').validator('$truthy'));

    // Boolean true
    assert.strictEqual(await schema.validateValue(true), true);

    // Truthy human-friendly strings (isTruthy special cases)
    assert.strictEqual(await schema.validateValue('true'), 'true');
    assert.strictEqual(await schema.validateValue('yes'), 'yes');
    assert.strictEqual(await schema.validateValue('on'), 'on');
    assert.strictEqual(await schema.validateValue('enabled'), 'enabled');
    assert.strictEqual(await schema.validateValue('1'), '1');
    assert.strictEqual(await schema.validateValue('active'), 'active');

    // Non-empty strings that are neither truthy nor falsey keywords fall back to Boolean()
    assert.strictEqual(await schema.validateValue('hello'), 'hello');
    assert.strictEqual(await schema.validateValue('some text'), 'some text');

    // Truthy numbers
    assert.strictEqual(await schema.validateValue(42), 42);
    assert.strictEqual(await schema.validateValue(-1), -1);

    // Truthy objects/arrays
    assert.deepStrictEqual(await schema.validateValue({}), {});
    assert.deepStrictEqual(await schema.validateValue([1]), [1]);
  });

  it('should throw for falsey values', async function() {
    const schema = await resolver.compile(new Schema('any').validator('$truthy'));

    // Boolean false
    await assert.rejects(() => schema.validateValue(false), ValidationError);

    // Falsey human-friendly strings (isTruthy special cases — these override JS truthiness)
    await assert.rejects(() => schema.validateValue('false'), ValidationError);
    await assert.rejects(() => schema.validateValue('no'), ValidationError);
    await assert.rejects(() => schema.validateValue('off'), ValidationError);
    await assert.rejects(() => schema.validateValue('disabled'), ValidationError);
    await assert.rejects(() => schema.validateValue('0'), ValidationError);
    await assert.rejects(() => schema.validateValue(''), ValidationError);

    // JS falsey number
    await assert.rejects(() => schema.validateValue(0), ValidationError);

    // Error instances are always falsey per isTruthy()
    await assert.rejects(() => schema.validateValue(new Error('oops')), ValidationError);
  });
});
