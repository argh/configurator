
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';

/**
 * Registers a `$collect` processor that returns its compiled args as the result.
 * Used to inspect what the resolver compiled and to exercise argument-passing paths.
 *
 * @param {SchemaResolver} resolver
 */
function registerCollect(resolver) {
  resolver.registerValueProcessorDefinition({
    keyword: 'collect',
    process: (_value, _target, _location, options) => options.args,
  });
}

describe('Processor Basics - parameter compilation and argument execution', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
    registerCollect(resolver);
  });

  describe('constant args (ArrayExecutor constant path)', function() {

    it('should evaluate all-literal args once and reuse the result', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [{$literal: 'a'}, {$literal: 42}]})
      );
      assert.deepStrictEqual(await schema.transformValue('input'), ['a', 42]);
      // Second call to confirm constant result is stable
      assert.deepStrictEqual(await schema.transformValue('other'), ['a', 42]);
    });

    it('should treat {$literal: <keyword-string>} as a constant, not a keyword call', async function() {
      // '$trim' is a registered keyword — wrapping it in $literal must prevent execution
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [{$literal: '$trim'}]})
      );
      assert.deepStrictEqual(await schema.transformValue('  hello  '), ['$trim']);
    });

    it('should treat {$literal: <nested-spec>} as a constant opaque object', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [{$literal: {$shouldNotExecute: true}}]})
      );
      assert.deepStrictEqual(await schema.transformValue('x'), [{$shouldNotExecute: true}]);
    });
  });

  describe('non-constant sync args (ArrayExecutor execute loop)', function() {

    it('should call function args with the current input on each invocation', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [v => v.toUpperCase(), {$literal: 99}]})
      );
      assert.deepStrictEqual(await schema.transformValue('hello'), ['HELLO', 99]);
      assert.deepStrictEqual(await schema.transformValue('world'), ['WORLD', 99]);
    });

    it('should compile a scalar (non-array) arg by wrapping it in an array', async function() {
      // When rawArgs is a scalar function, map() wraps it: args = [compiledFn]
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: v => `got:${v}`})
      );
      assert.deepStrictEqual(await schema.transformValue('x'), ['got:x']);
    });
  });

  describe('non-constant async args (ArrayExecutor #resume path)', function() {

    it('should collect async arg results in declaration order', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [async v => `${v}!`, {$literal: 0}]})
      );
      assert.deepStrictEqual(await schema.transformValue('hi'), ['hi!', 0]);
    });

    it('should handle all-async args', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: [async v => v * 2, async v => v * 3]})
      );
      assert.deepStrictEqual(await schema.transformValue(5), [10, 15]);
    });
  });

  describe('object args (ObjectExecutor path)', function() {

    it('should pass object-keyed args and execute each value with input', async function() {
      const schema = await resolver.compile(
        new Schema('any').transformer({$collect: {key: v => v * 2}})
      );
      assert.deepStrictEqual(await schema.transformValue(5), {key: 10});
    });
  });

  describe('registration errors', function() {

    it('should throw at compile time for an unknown keyword', async function() {
      await assert.rejects(
        () => resolver.compile(new Schema('any').transformer('$not-a-keyword')),
        SchemaError
      );
    });
  });
});
