
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Unions: Property-Based Discriminator', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should discriminate union using property name string', async function() {
    const schema = new Schema('object')
      .property('type', new Schema('string').values(['circle', 'square']))
      .unionDiscriminator('type')
      .unionSchema('circle', new Schema('object')
        .property('type', Schema.literal('circle'))
        .property('radius', new Schema('number'))
      )
      .unionSchema('square', new Schema('object')
        .property('type', Schema.literal('square'))
        .property('side', new Schema('number'))
      );

    const compiled = resolver.compile(schema);

    const resultCircle = await compiled.discriminateUnion({type: 'circle', radius: 5}, {}, '');
    assert.ok(resultCircle);
    assert.strictEqual(compiled.findUnionKey(resultCircle), 'circle');

    const resultSquare = await compiled.discriminateUnion({type: 'square', side: 10}, {}, '');
    assert.ok(resultSquare);
    assert.strictEqual(compiled.findUnionKey(resultSquare), 'square');
  });

  it('should normalize discriminator property value', async function() {
    // This tests that the discriminator properly uses the property's normalizer
    const normalizer = (v) => v.toLowerCase();

    const schema = new Schema('object')
      .property('type', new Schema('string')
        .normalizer(normalizer)
        .values(['CIRCLE', 'SQUARE'])
      )
      .unionDiscriminator('type')
      .unionSchema('CIRCLE', new Schema('object')
        .property('type', Schema.literal('CIRCLE').normalizer(normalizer))
      )
      .unionSchema('SQUARE', new Schema('object')
        .property('type', Schema.literal('SQUARE').normalizer(normalizer))
      );

    const compiled = resolver.compile(schema);

    // Input with different casing should still match due to normalization
    const result = await compiled.discriminateUnion({type: 'Circle'}, {}, '');
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'CIRCLE');
  });

  it('should handle raw discriminator value lookup', async function() {
    const schema = new Schema('object')
      .property('kind', new Schema('string').values(['a', 'b']))
      .unionDiscriminator('kind')
      .unionSchema('a', new Schema('object')
        .property('kind', Schema.literal('a'))
      )
      .unionSchema('b', new Schema('object')
        .property('kind', Schema.literal('b'))
      );

    const compiled = resolver.compile(schema);

    const result = await compiled.discriminateUnion({kind: 'a'}, {}, '');
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'a');
  });

  it('should return undefined for non-matching discriminator value', async function() {
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionDiscriminator('type')
      .unionSchema('valid', new Schema('object')
        .property('type', Schema.literal('valid'))
      );

    const compiled = resolver.compile(schema);

    const result = await compiled.discriminateUnion({type: 'invalid'}, {}, '');
    assert.strictEqual(result, undefined);
  });

  it('should return undefined when discriminator property is missing', async function() {
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionDiscriminator('type')
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('a'))
      );

    const compiled = resolver.compile(schema);

    const result = await compiled.discriminateUnion({}, {}, '');
    assert.strictEqual(result, undefined);
  });

  it('should synthesize discriminator property values from union keys', function() {
    const schema = new Schema('object')
      .property('type', new Schema('string'))
      .unionDiscriminator('type')
      .unionSchema('option1', new Schema('object')
        .property('type', Schema.literal('option1'))
      )
      .unionSchema('option2', new Schema('object')
        .property('type', Schema.literal('option2'))
      )
      .unionSchema('option3', new Schema('object')
        .property('type', Schema.literal('option3'))
      );

    const compiled = resolver.compile(schema);

    // The discriminator property should have values synthesized from union keys
    const typeProperty = compiled.properties.type;
    assert.ok(typeProperty);
    assert.ok(Array.isArray(typeProperty.values));
    assert.strictEqual(typeProperty.values.length, 3);
  });

  it('should handle numeric union keys with property discriminator', async function() {
    const schema = new Schema('object')
      .property('code', new Schema('number'))
      .unionDiscriminator('code')
      .unionSchema('1', new Schema('object')
        .property('code', Schema.literal(1))
      )
      .unionSchema('2', new Schema('object')
        .property('code', Schema.literal(2))
      );

    const compiled = resolver.compile(schema);

    const result = await compiled.discriminateUnion({code: 1}, {}, '');
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), '1');
  });
});
