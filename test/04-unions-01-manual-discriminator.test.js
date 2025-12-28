
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ValidationError } from '../src/errors.js';

describe('Unions: Manual Discriminator Function', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should discriminate union using custom function', async function() {
    // Manual discriminator should work even without constrained values
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
        .property('aValue', new Schema('string'))
      )
      .unionSchema('b', new Schema('object')
        .property('type', Schema.literal('b'))
        .property('bValue', new Schema('number'))
      )
      .unionDiscriminator((value, _, unionSchema) => {
        if (value.type === 'a') return unionSchema.unionSchemas.a;
        if (value.type === 'b') return unionSchema.unionSchemas.b;
        return undefined;
      });

    const compiled = await resolver.compile(schema);

    // Test discriminateUnion directly
    const resultA = await compiled.discriminateUnion({type: 'a', aValue: 'test'});
    assert.ok(resultA);
    assert.strictEqual(compiled.findUnionKey(resultA), 'a');

    const resultB = await compiled.discriminateUnion({type: 'b', bValue: 42});
    assert.ok(resultB);
    assert.strictEqual(compiled.findUnionKey(resultB), 'b');
  });

  it('should return undefined for non-matching value', async function() {
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
      )
      .unionDiscriminator((value) => {
        if (value.type === 'a') return schema.unionSchemas.a;
        return undefined;
      });

    const compiled = await resolver.compile(schema);

    const result = await compiled.discriminateUnion({type: 'unknown'});
    assert.strictEqual(result, undefined);
  });

  it('should allow discriminator to access configuration state', async function() {
    const schema = new Schema('object')
      .property('mode', new Schema('string'))
      .unionSchema('strict', new Schema('object')
        .property('mode', Schema.literal('strict'))
        .property('value', new Schema('string'))
      )
      .unionSchema('lax', new Schema('object')
        .property('mode', Schema.literal('lax'))
        .property('value', new Schema('any'))
      )
      .unionDiscriminator((value, configuration, unionSchema) => {
        // Discriminator can look at configuration state
        if (configuration.mode === 'strict') {
          return unionSchema.unionSchemas.strict;
        }
        return unionSchema.unionSchemas.lax;
      });

    const compiled = await resolver.compile(schema);

    const resultStrict = await compiled.discriminateUnion(
      {mode: 'strict', value: 'test'},
      {mode: 'strict'},
      ''
    );
    assert.ok(resultStrict);
    assert.strictEqual(compiled.findUnionKey(resultStrict), 'strict');

    const resultLax = await compiled.discriminateUnion(
      {mode: 'lax', value: 123},
      {mode: 'lax'},
      ''
    );
    assert.ok(resultLax);
    assert.strictEqual(compiled.findUnionKey(resultLax), 'lax');
  });

  it('should handle async discriminator function', async function() {
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
      )
      .unionDiscriminator(async (value, _, unionSchema) => {
        // Simulate async lookup
        await new Promise(resolve => setTimeout(resolve, 1));
        if (value.type === 'a') return unionSchema.unionSchemas.a;
        return undefined;
      });

    const compiled = await resolver.compile(schema);

    const result = await compiled.discriminateUnion({type: 'a'});
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'a');
  });

  it('should work even when value is undefined', async function() {
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
      )
      .unionDiscriminator((v, c, s) => s.unionSchemas.a);

    const compiled = await resolver.compile(schema);

    const result = await compiled.discriminateUnion(undefined);
    assert.strictEqual(result, compiled.unionSchemas.a);
  });

  it('should identify union schema correctly', async function() {
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
      )
      .unionSchema('b', new Schema('object')
        .property('type', Schema.literal('b'))
      )
      .unionDiscriminator((value, _, unionSchema) => {
        if (value.type === 'a') return unionSchema.unionSchemas.a;
        if (value.type === 'b') return unionSchema.unionSchemas.b;
        return undefined;
      });

    const compiled = await resolver.compile(schema);

    assert.strictEqual(compiled.isUnion, true);
    assert.strictEqual(Object.keys(compiled.unionSchemas).length, 2);
  });

  it('should find union key for given schema', async function() {
    const schemaA = new Schema('object')
      .property('a', Schema.literal('a-value'));
    const schemaB = new Schema('object')
      .property('b', Schema.literal('b-value'));

    const schema = new Schema('object')
      .unionSchema('keyA', schemaA)
      .unionSchema('keyB', schemaB)
      .unionDiscriminator((value, _, unionSchema) => {
        if (value.a) return unionSchema.unionSchemas.keyA;
        if (value.b) return unionSchema.unionSchemas.keyB;
        return undefined;
      });

    const compiled = await resolver.compile(schema);

    const compiledA = compiled.unionSchemas.keyA;
    const compiledB = compiled.unionSchemas.keyB;

    assert.strictEqual(compiled.findUnionKey(compiledA), 'keyA');
    assert.strictEqual(compiled.findUnionKey(compiledB), 'keyB');
  });
});
