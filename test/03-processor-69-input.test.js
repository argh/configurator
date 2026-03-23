
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Processor: $input', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should return the pipeline input value unchanged', async function() {
    const schema = await resolver.compile(new Schema('any').transformer('$input'));
    assert.strictEqual(await schema.transformValue('sparrow'), 'sparrow');
    assert.strictEqual(await schema.transformValue(42), 42);
    assert.strictEqual(await schema.transformValue(true), true);
    const ref = {bird: 'wren'};
    assert.strictEqual(await schema.transformValue(ref), ref);  // same reference
  });

  it('should forward a pipeline value as a named arg to a downstream processor', async function() {
    // The canonical use case: pass the pipeline value into an arg slot that doesn't receive it by default.
    // $find-schema produces the current CompiledSchema; $input then hands that schema to $metadata.
    const schema = await resolver.compile(
      new Schema('string')
        .meta('greeting', 'hello')
        .transformer({'$find-schema': '.'})
        .transformer({'$metadata': {name: 'greeting', schema: '$input'}})
    );
    assert.strictEqual(await schema.transformValue('anything'), 'hello');
  });
});
