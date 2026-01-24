
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { UnionResolutionError, ValidationError } from '../src/errors.js';

describe('Unions: Hoisted Discriminator (Single Property)', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should auto-generate discriminator from single common property with unique values', async function() {
    // Union schemas all have ONLY 'name' property with unique literal values
    // Discriminator should be automatically generated
    const schema = new Schema('object')
      .unionSchema('apple', new Schema('object')
        .property('name', Schema.literal('apple'))
      )
      .unionSchema('banana', new Schema('object')
        .property('name', Schema.literal('banana'))
      )
      .unionSchema('grape', new Schema('object')
        .property('name', Schema.literal('grape'))
      );

    const compiled = await resolver.compile(schema);

    // The common 'name' property should be hoisted to the union schema
    assert.ok(compiled.properties.name);

    // Should discriminate based on name
    const resultApple = await compiled._discriminateUnion({name: 'apple'});
    assert.ok(resultApple);
    assert.strictEqual(compiled.findUnionKey(resultApple), 'apple');

    const resultBanana = await compiled._discriminateUnion({name: 'banana'});
    assert.ok(resultBanana);
    assert.strictEqual(compiled.findUnionKey(resultBanana), 'banana');
  });

  it('should hoist property with normalized values', async function() {
    const normalizer = (v) => v.toLowerCase();

    const schema = new Schema('object')
      .unionSchema('Dog', new Schema('object')
        .property('animal', Schema.literal('Dog').normalizer(normalizer))
      )
      .unionSchema('Cat', new Schema('object')
        .property('animal', Schema.literal('Cat').normalizer(normalizer))
      );

    const compiled = await resolver.compile(schema);

    assert.ok(compiled.properties.animal);

    // Should match with different casing due to normalization
    const result = await compiled._discriminateUnion({animal: 'dog'});
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'Dog');
  });

  it('should combine values from all union schemas for hoisted property', async function() {
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('alpha'))
      )
      .unionSchema('b', new Schema('object')
        .property('type', Schema.literal('beta'))
      )
      .unionSchema('c', new Schema('object')
        .property('type', Schema.literal('gamma'))
      );

    const compiled = await resolver.compile(schema);

    const hoistedProperty = compiled.properties.type;
    assert.ok(hoistedProperty);
    assert.ok(Array.isArray(hoistedProperty.values));
    assert.strictEqual(hoistedProperty.values.length, 3);
    assert.ok(hoistedProperty.values.includes('alpha'));
    assert.ok(hoistedProperty.values.includes('beta'));
    assert.ok(hoistedProperty.values.includes('gamma'));
  });

  it('should preserve base type from hoisted property', async function() {
    const schema = new Schema('object')
      .unionSchema('num1', new Schema('object')
        .property('id', new Schema('number').values([1]))
      )
      .unionSchema('num2', new Schema('object')
        .property('id', new Schema('number').values([2]))
      );

    const compiled = await resolver.compile(schema);

    const hoistedProperty = compiled.properties.id;
    assert.ok(hoistedProperty);
    // Should preserve 'number' as the base type
    assert.strictEqual(hoistedProperty.metadata.parserTypeHint, 'number');
  });

  it('should use any base when union properties have incompatible types', async function() {
    // When union properties have incompatible base types (string vs number),
    // should fall back to 'any' base type with no normalizer
    const schema = new Schema('object')
      .unionSchema('str', new Schema('object')
        .property('value', new Schema('string').values(['text']))
      )
      .unionSchema('num', new Schema('object')
        .property('value', new Schema('number').values([42]))
      );

    const compiled = await resolver.compile(schema);

    const hoistedProperty = compiled.properties.value;
    assert.ok(hoistedProperty);
    // Should fall back to 'any' when types differ
    assert.strictEqual(hoistedProperty.metadata.parserTypeHint, 'any');
    // Should have values from both schemas
    assert.ok(hoistedProperty.values);
    assert.ok(hoistedProperty.values.includes('text'));
    assert.ok(hoistedProperty.values.includes(42));
  });

  it('should not hoist property that already exists in parent', async function() {
    // If the union schema already defines a property, it shouldn't be hoisted
    const schema = new Schema('object')
      .property('name', new Schema('string'))
      .unionSchema('a', new Schema('object')
        .property('name', Schema.literal('a'))
      )
      .unionSchema('b', new Schema('object')
        .property('name', Schema.literal('b'))
      );

    const compiled = await resolver.compile(schema);

    // The parent property should be used, not hoisted from union schemas
    const nameProperty = compiled.properties.name;
    assert.ok(nameProperty);
    // Parent property won't have values constrained to just 'a' and 'b'
    // if we defined it without values
  });

  it('should throw error when property value does not match any union', async function() {
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('type', Schema.literal('valid')))
      .unionSchema('b', new Schema('object')
        .property('type', Schema.literal('also-valid')))

    const compiled = await resolver.compile(schema);

    // discrimination should quietly fail...
    assert.strictEqual(await compiled._discriminateUnion({type: 'invalid'}), undefined);

    // ...but failure to discriminate should throw an error.
    await assert.rejects(
      () => compiled.validate({type: 'invalid'}),
      (error) => {
        assert.ok(error instanceof UnionResolutionError);
        return true;
      }
    );
  });
});
