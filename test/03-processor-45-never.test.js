
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

/**
 * $never inverts a processor — it passes through the original input when the wrapped processor
 * fails, and throws a ConstraintError when the wrapped processor succeeds.
 */
describe('Processor: never', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // too many positional args
    await assert.rejects(
      () => resolver.compile(new Schema('any').validator({$never: ['$numeric', '$alpha']})),
      SchemaError
    );
  });

  it('should pass through the input when the wrapped processor fails', async function() {
    // {$never: '$numeric'} passes when input is NOT numeric
    const schema = await resolver.compile(new Schema('any').validator({$never: '$numeric'}));

    assert.strictEqual(await schema.validateValue('abc'), 'abc');
    assert.strictEqual(await schema.validateValue('hello world'), 'hello world');
    assert.strictEqual(await schema.validateValue('12.34'), '12.34');  // has decimal → not numeric

    // $never with regex: input must NOT match the pattern
    const noTest = await resolver.compile(new Schema('any').validator({$never: /^test/}));
    assert.strictEqual(await noTest.validateValue('other'), 'other');
    assert.strictEqual(await noTest.validateValue('something'), 'something');
  });

  it('should throw when the wrapped processor succeeds', async function() {
    const schema = await resolver.compile(new Schema('any').validator({$never: '$numeric'}));

    // $numeric succeeds for these → $never throws ConstraintError
    await assert.rejects(() => schema.validateValue('123'), ValidationError);
    await assert.rejects(() => schema.validateValue('0'), ValidationError);
    await assert.rejects(() => schema.validateValue('999'), ValidationError);

    // regex form: must NOT start with 'test'
    const noTest = await resolver.compile(new Schema('any').validator({$never: /^test/}));
    await assert.rejects(() => noTest.validateValue('test123'), ValidationError);
    await assert.rejects(() => noTest.validateValue('testing'), ValidationError);
  });
});
