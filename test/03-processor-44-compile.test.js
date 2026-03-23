
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';
import { SchemaError } from '../src/schema/schema-errors.js';
import { SchemaCompiler } from '../src/schema/schema-compiler.js';

describe('Processor: $compile', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should reject invalid configuration at compile time', async function() {
    // more than two arguments are not allowed
    await assert.rejects(
      () => resolver.compile(
        new Schema('any').transformer({$compile: [{$literal: new Schema('string')}, {$literal: new Schema('number')}, 123]})
      ),
      SchemaError
    );
  });

  it('should compile a Schema from the pipeline value (zero-arg form)', async function() {
    // $literal injects a Schema into the pipeline; $compile then compiles it
    const inner = new Schema('string').transformer('$uppercase');
    const schema = await resolver.compile(
      new Schema('any')
        .transformer({$pipeline: [{$literal: inner}, '$compile']})
    );
    const result = await schema.transformValue('ignored');
    assert.ok(result instanceof CompiledSchema);
    assert.strictEqual(await result.transformValue('hello'), 'HELLO');
  });

  it('should compile a Schema provided as a named argument', async function() {
    const inner = new Schema('string').transformer('$lowercase');
    const schema = await resolver.compile(
      new Schema('any')
        .transformer({$compile: {schema: {$literal: inner}}})
    );
    const result = await schema.transformValue('ignored');
    assert.ok(result instanceof CompiledSchema);
    assert.strictEqual(await result.transformValue('HELLO'), 'hello');
  });

  it('should compile a raw SchemaData object provided as a literal', async function() {
    // $compile can also accept SchemaData (plain object shape) as input
    const schemaData = {handlers: {transformers: [(v) => `wrapped(${v})`]}};
    const schema = await resolver.compile(
      new Schema('any')
        .transformer({$compile: [{$literal: schemaData}]})
    );
    const result = await schema.transformValue('ignored');
    assert.ok(result instanceof CompiledSchema);
    assert.strictEqual(await result.transformValue('fig'), 'wrapped(fig)');
  });
  it('should allow a custom compiler', async function() {
    const customResolver = new SchemaResolver();
    resolver.registerSchema('test-schema', new Schema('string').normalizer(() => 'stick'))
    customResolver.registerSchema('test-schema', new Schema('string').normalizer(() => 'carrot'))
    const customCompiler = new SchemaCompiler(customResolver);

    const inner = new Schema('test-schema').transformer('$uppercase');
    const schema = await resolver.compile(
      new Schema('any')
        .transformer({$process: {$compile: {schema: {$literal: inner}, compiler: customCompiler}}})
    );
    const result = await schema.transformValue('ignored');
    assert.strictEqual(result, 'CARROT');
  });


});
