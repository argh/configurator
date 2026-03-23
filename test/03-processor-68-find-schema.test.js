
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError } from '../src/schema/schema-errors.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';

describe('Processor: $find-schema', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should throw at runtime if path is not a string', async function() {
    const schema = await resolver.compile(new Schema('any').transformer({'$find-schema': {path: 42}}));
    await assert.rejects(() => schema.transformValue('x'), SchemaError);
  });

  it('should return the current schema for empty or self-referential paths', async function() {
    const schema = await resolver.compile(
      new Schema('string').meta('label', 'canary').transformer({'$find-schema': '.'})
    );
    const result = await schema.transformValue('anything');
    assert.ok(result instanceof CompiledSchema);
    assert.strictEqual(result.metadata.label, 'canary');
  });

  it('should navigate to a child schema by name', async function() {
    const schema = await resolver.compile(
      new Schema('object')
        .property('wing', new Schema('string').meta('label', 'finch'))
        .property('found', new Schema('any').transformer({'$find-schema': '^.wing'}))
    );
    const result = await schema.process({wing: 'left', found: 'placeholder'});
    assert.ok(result.found instanceof CompiledSchema);
    assert.strictEqual(result.found.metadata.label, 'finch');
  });

  it('should navigate to the root schema via "/"', async function() {
    const schema = await resolver.compile(
      new Schema('object')
        .meta('label', 'root')
        .property('child', new Schema('any').transformer({'$find-schema': '/'}))
    );
    const result = await schema.process({child: 'placeholder'});
    assert.ok(result.child instanceof CompiledSchema);
    assert.strictEqual(result.child.metadata.label, 'root');
  });

  it('should navigate to the parent schema via "^"', async function() {
    const schema = await resolver.compile(
      new Schema('object')
        .meta('label', 'parent')
        .property('child', new Schema('any').transformer({'$find-schema': '^'}))
    );
    const result = await schema.process({child: 'placeholder'});
    assert.ok(result.child instanceof CompiledSchema);
    assert.strictEqual(result.child.metadata.label, 'parent');
  });

  it('should return undefined for a path that does not exist', async function() {
    const schema = await resolver.compile(
      new Schema('string').transformer({'$find-schema': 'no-such-child'})
    );
    assert.strictEqual(await schema.transformValue('anything'), undefined);
  });
});
