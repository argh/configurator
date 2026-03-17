
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';

describe('Processor: parallel', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // plain object args are not an array — the resolver maps objects as {key: compiledSpec},
    // which is not an array, so build() rejects it
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer({$parallel: {processor: '$numeric'}})),
      SchemaError
    );
  });

  it('should apply all processors to the same input and return results as array', async function() {
    // Each processor receives the original input, not the output of the previous
    const schema = await resolver.compile(
      new Schema('any').transformer({$parallel: ['$trim', '$uppercase']})
    );
    // $trim('  hello  ') → 'hello', $uppercase('  hello  ') → '  HELLO  '
    assert.deepStrictEqual(await schema.transformValue('  hello  '), ['hello', '  HELLO  ']);

    // Single processor — still returns array
    const single = await resolver.compile(new Schema('any').transformer({$parallel: ['$trim']}));
    assert.deepStrictEqual(await single.transformValue('  hi  '), ['hi']);

    // Empty array — returns empty array
    const empty = await resolver.compile(new Schema('any').transformer({$parallel: []}));
    assert.deepStrictEqual(await empty.transformValue('anything'), []);
  });

  it('should collect results concurrently when processors are async', async function() {
    const order = [];

    // Two async processors with different delays; both receive the same input.
    // With Promise.all semantics both are in-flight simultaneously.
    const slow = async (v) => { await new Promise(r => setTimeout(r, 20)); order.push('slow'); return `slow:${v}`; };
    const fast = async (v) => { await new Promise(r => setTimeout(r, 5));  order.push('fast'); return `fast:${v}`; };

    const schema = await resolver.compile(
      new Schema('any').transformer({$parallel: [slow, fast]})
    );

    const result = await schema.transformValue('x');

    // Results are in declaration order, not completion order
    assert.deepStrictEqual(result, ['slow:x', 'fast:x']);

    // fast completes before slow — confirms concurrent execution, not sequential
    assert.deepStrictEqual(order, ['fast', 'slow']);
  });

  it('should propagate errors immediately without collecting other results', async function() {
    // sync fail-fast: $numeric throws for non-numeric input
    const syncSchema = await resolver.compile(
      new Schema('any').validator({$parallel: ['$numeric', '$alpha']})
    );
    await assert.rejects(() => syncSchema.validateValue('hello'), ValidationError); // $numeric fails
    await assert.rejects(() => syncSchema.validateValue('123'), ValidationError);   // $alpha fails

    // async fail-fast: rejection surfaces without waiting for the other promise
    const rejected = async () => { throw new Error('boom'); };
    const asyncSchema = await resolver.compile(
      new Schema('any').transformer({$parallel: [rejected, async v => v]})
    );
    await assert.rejects(() => asyncSchema.transformValue('x'), Error);
  });
});
