
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe('Unions: Multi-Property Hoisting', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  it('should hoist multiple common properties with unique combinations', async function() {
    // Like the cheese example - multiple properties can uniquely identify the union member
    const schema = new Schema('object')
      .unionSchema('apple', new Schema('object')
        .property('name', Schema.literal('apple'))
        .property('color', Schema.literal('red'))
      )
      .unionSchema('banana', new Schema('object')
        .property('name', Schema.literal('banana'))
        .property('color', Schema.literal('yellow'))
      )
      .unionSchema('grape', new Schema('object')
        .property('name', Schema.literal('grape'))
        .property('color', Schema.literal('purple'))
      );

    const compiled = await resolver.compile(schema);

    // Both properties should be hoisted
    assert.ok(compiled.properties.name);
    assert.ok(compiled.properties.color);

    // Should discriminate using name
    const resultApple = await compiled._discriminateUnion({name: 'apple', color: 'red'});
    assert.ok(resultApple);
    assert.strictEqual(compiled.findUnionKey(resultApple), 'apple');
  });

  it('should discriminate when only subset of properties provided', async function() {
    const schema = new Schema('object')
      .unionSchema('red-apple', new Schema('object')
        .property('fruit', Schema.literal('apple'))
        .property('color', Schema.literal('red'))
        .property('size', Schema.literal('medium'))
      )
      .unionSchema('green-apple', new Schema('object')
        .property('fruit', Schema.literal('apple'))
        .property('color', Schema.literal('green'))
        .property('size', Schema.literal('small'))
      )
      .unionSchema('red-cherry', new Schema('object')
        .property('fruit', Schema.literal('cherry'))
        .property('color', Schema.literal('red'))
        .property('size', Schema.literal('small'))
      );

    const compiled = await resolver.compile(schema);

    // All three properties should be hoisted
    assert.ok(compiled.properties.fruit);
    assert.ok(compiled.properties.color);
    assert.ok(compiled.properties.size);

    // Can identify with just fruit + color
    const result = await compiled._discriminateUnion({fruit: 'apple', color: 'green'});
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'green-apple');
  });

  it('should handle overlapping property values requiring multiple properties', async function() {
    // Two union members share 'type', need 'subtype' to discriminate
    const schema = new Schema('object')
      .unionSchema('vehicle-car', new Schema('object')
        .property('type', Schema.literal('vehicle'))
        .property('subtype', Schema.literal('car'))
      )
      .unionSchema('vehicle-truck', new Schema('object')
        .property('type', Schema.literal('vehicle'))
        .property('subtype', Schema.literal('truck'))
      )
      .unionSchema('animal-dog', new Schema('object')
        .property('type', Schema.literal('animal'))
        .property('subtype', Schema.literal('dog'))
      );

    const compiled = await resolver.compile(schema);

    assert.ok(compiled.properties.type);
    assert.ok(compiled.properties.subtype);

    // Need both properties to discriminate vehicles
    const result = await compiled._discriminateUnion({type: 'vehicle', subtype: 'car'});
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'vehicle-car');
  });

  it('should hoist properties with different base types', async function() {
    const schema = new Schema('object')
      .unionSchema('opt1', new Schema('object')
        .property('id', new Schema('number').values([1]))
        .property('name', new Schema('string').values(['first']))
      )
      .unionSchema('opt2', new Schema('object')
        .property('id', new Schema('number').values([2]))
        .property('name', new Schema('string').values(['second']))
      );

    const compiled = await resolver.compile(schema);

    const idProp = compiled.properties.id;
    const nameProp = compiled.properties.name;

    assert.ok(idProp);
    assert.ok(nameProp);
    assert.strictEqual(idProp.metadata.parserTypeHint, 'number');
    assert.strictEqual(nameProp.metadata.parserTypeHint, 'string');
  });

  it('should handle boolean properties in multi-property hoisting', async function() {
    const schema = new Schema('object')
      .unionSchema('option-a', new Schema('object')
        .property('flag', Schema.literal(true))
        .property('type', Schema.literal('a'))
      )
      .unionSchema('option-b', new Schema('object')
        .property('flag', Schema.literal(false))
        .property('type', Schema.literal('b'))
      );

    const compiled = await resolver.compile(schema);

    assert.ok(compiled.properties.flag);
    assert.ok(compiled.properties.type);

    const result = await compiled._discriminateUnion({flag: true, type: 'a'});
    assert.ok(result);
    assert.strictEqual(compiled.findUnionKey(result), 'option-a');
  });

  it('should combine all values for each hoisted property', async function() {
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('x', Schema.literal(1))
        .property('y', Schema.literal('foo'))
      )
      .unionSchema('b', new Schema('object')
        .property('x', Schema.literal(2))
        .property('y', Schema.literal('bar'))
      )
      .unionSchema('c', new Schema('object')
        .property('x', Schema.literal(3))
        .property('y', Schema.literal('baz'))
      );

    const compiled = await resolver.compile(schema);

    const xProp = compiled.properties.x;
    const yProp = compiled.properties.y;

    assert.ok(Array.isArray(xProp.values));
    assert.strictEqual(xProp.values.length, 3);
    assert.ok(xProp.values.includes(1));
    assert.ok(xProp.values.includes(2));
    assert.ok(xProp.values.includes(3));

    assert.ok(Array.isArray(yProp.values));
    assert.strictEqual(yProp.values.length, 3);
    assert.ok(yProp.values.includes('foo'));
    assert.ok(yProp.values.includes('bar'));
    assert.ok(yProp.values.includes('baz'));
  });

  it('should hoist all properties with constrained values even if not common', async function() {
    // Properties with constrained values are hoisted even if not present in all schemas
    // This allows discriminating by property existence
    const schema = new Schema('object')
      .unionSchema('a', new Schema('object')
        .property('common', Schema.literal('a'))
        .property('uniqueToA', Schema.literal('aaa'))
      )
      .unionSchema('b', new Schema('object')
        .property('common', Schema.literal('b'))
        .property('uniqueToB', Schema.literal('bbb'))
      );

    const compiled = await resolver.compile(schema);

    // All properties with constrained values should be hoisted
    assert.ok(compiled.properties.common);
    assert.ok(compiled.properties.uniqueToA);
    assert.ok(compiled.properties.uniqueToB);
  });

  it('should handle normalizers consistently across hoisted properties', async function() {
    const normalizer = (v) => v.trim().toLowerCase();

    const schema = new Schema('object')
      .unionSchema('alpha', new Schema('object')
        .property('code', Schema.literal('ALPHA').normalizer(normalizer))
      )
      .unionSchema('beta', new Schema('object')
        .property('code', Schema.literal('BETA').normalizer(normalizer))
      );

    const compiled = await resolver.compile(schema);

    const hoistedProp = compiled.properties.code;
    assert.ok(hoistedProp);

    // The hoisted property should have the same normalizer
    const normalized = await hoistedProp._normalizeValue('  Alpha  ');
    assert.strictEqual(normalized, 'alpha');
  });
});
