
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, TransformError } from '../src/schema/schema-errors.js';

describe('Processor: $process', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject a missing schema argument at compile time', async function() {
    await assert.rejects(
      () => resolver.compile(new Schema('any').transformer('$process')),
      SchemaError
    );
  });

  it('should throw at runtime when the schema argument is not a CompiledSchema', async function() {
    // $literal passes a raw object — not a CompiledSchema — at runtime
    const schema = await resolver.compile(
      new Schema('any').transformer({$process: {schema: {$literal: {not: 'a schema'}}}})
    );
    await assert.rejects(() => schema.transformValue('fig'), TransformError);
  });

  it('should process the pipeline value through the provided CompiledSchema', async function() {
    const inner = await resolver.compile(
      new Schema('string').transformer('$uppercase')
    );
    const schema = await resolver.compile(
      new Schema('any').transformer({$process: {schema: {$literal: inner}}})
    );
    assert.strictEqual(await schema.transformValue('apricot'), 'APRICOT');
  });

  it('should compose $compile and $process to apply an inline schema to the value', async function() {
    // The combined pattern: compile a schema inline, then apply it — the core use case
    const schema = await resolver.compile(
      new Schema('any').transformer(
        {$process: {schema: {$compile: [{$literal: new Schema('string').transformer('$kebab-case')}]}}}
      )
    );
    assert.strictEqual(await schema.transformValue('Hello World'), 'hello-world');
    assert.strictEqual(await schema.transformValue('FOO_BAR'), 'foo-bar');
  });
});
