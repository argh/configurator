
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';

describe('Schema Compilation - Union Structure', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Union schema definition on Schema instances', function() {

    it('should define union schemas on a Schema', function() {
      const schema = new Schema('object')
        .unionSchema('optionA', new Schema('object')
          .property('type', new Schema('string').values(['A'])))
        .unionSchema('optionB', new Schema('object')
          .property('type', new Schema('string').values(['B'])));

      assert.ok(schema.unionSchemas.optionA instanceof Schema);
      assert.ok(schema.unionSchemas.optionB instanceof Schema);
      assert.strictEqual(Object.keys(schema.unionSchemas).length, 2);
    });

    it('should allow multiple union schemas', function() {
      const schema = new Schema('object')
        .unionSchema('a', new Schema('object').property('kind', new Schema('string').values(['a'])))
        .unionSchema('b', new Schema('object').property('kind', new Schema('string').values(['b'])))
        .unionSchema('c', new Schema('object').property('kind', new Schema('string').values(['c'])));

      assert.strictEqual(Object.keys(schema.unionSchemas).length, 3);
    });

    it('should support chaining unionSchema calls', function() {
      const schema = new Schema('object')
        .unionSchema('first', new Schema('object').property('type', new Schema('string').values(['first'])))
        .unionSchema('second', new Schema('object').property('type', new Schema('string').values(['second'])));

      assert.ok(schema.unionSchemas.first);
      assert.ok(schema.unionSchemas.second);
    });

    it('should store union schemas in unionSchemas object', function() {
      const schema = new Schema('object');

      assert.ok(schema.unionSchemas);
      assert.strictEqual(typeof schema.unionSchemas, 'object');
      assert.strictEqual(Object.keys(schema.unionSchemas).length, 0);
    });
  });

  describe('Union schema compilation', function() {

    it('should compile union schemas into CompiledSchema instances', async function() {
      const schema = new Schema('object')
        .unionSchema('optionA', new Schema('object')
          .property('type', new Schema('string').values(['A'])))
        .unionSchema('optionB', new Schema('object')
          .property('type', new Schema('string').values(['B'])));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.optionA instanceof CompiledSchema);
      assert.ok(compiled.unionSchemas.optionB instanceof CompiledSchema);
    });

    it('should compile union schema properties', async function() {
      const schema = new Schema('object')
        .unionSchema('option1', new Schema('object')
          .property('field', new Schema('string'))
          .property('type', new Schema('string').values(['option1'])));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.option1.properties.field instanceof CompiledSchema);
      assert.ok(compiled.unionSchemas.option1.properties.type instanceof CompiledSchema);
    });

    it('should compile nested union schema structures', async function() {
      const schema = new Schema('object')
        .unionSchema('nested', new Schema('object')
          .property('kind', new Schema('string').values(['nested']))
          .property('inner', new Schema('object')
            .property('deep', new Schema('string'))));

      const compiled = await resolver.compile(schema);

      const deepField = compiled.unionSchemas.nested.properties.inner.properties.deep;
      assert.ok(deepField instanceof CompiledSchema);
    });

    it('should resolve base types in union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('typed', new Schema('object')
          .property('kind', new Schema('string').values(['typed']))
          .property('value', new Schema('number')));

      const compiled = await resolver.compile(schema);

      // Should have number base type normalizer
      const valueSchema = compiled.unionSchemas.typed.properties.value;
      assert.strictEqual(typeof valueSchema._normalizeValue, 'function');
      assert.strictEqual(await valueSchema._normalizeValue('42'), 42);
    });
  });

  describe('isUnion flag', function() {

    it('should set isUnion to true when union schemas exist', async function() {
      const schema = new Schema('object')
        .unionSchema('option', new Schema('object')
          .property('type', new Schema('string').values(['option'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, true);
    });

    it('should set isUnion to false when no union schemas exist', async function() {
      const schema = new Schema('object')
        .property('regular', new Schema('string'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, false);
    });

    it('should set isUnion to false for empty schema', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, false);
    });

    it('should set isUnion to true even with just one union schema', async function() {
      const schema = new Schema('object')
        .unionSchema('single', new Schema('object')
          .property('type', new Schema('string').values(['single'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, true);
    });
  });

  describe('Discriminator presence', function() {

    it('should always have a discriminator when isUnion is true', async function() {
      const schema = new Schema('object')
        .unionSchema('optionA', new Schema('object')
          .property('type', new Schema('string').values(['A'])))
        .unionSchema('optionB', new Schema('object')
          .property('type', new Schema('string').values(['B'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, true);
      const discriminated = await compiled._discriminateUnion({type: 'A'}, {});
      assert.ok(discriminated);
    });

    it('should have discriminator for auto-generated case', async function() {
      const schema = new Schema('object')
        .unionSchema('a', new Schema('object')
          .property('kind', new Schema('string').values(['a'])))
        .unionSchema('b', new Schema('object')
          .property('kind', new Schema('string').values(['b'])));

      const compiled = await resolver.compile(schema);

      const discriminated = await compiled._discriminateUnion({kind: 'a'}, {});
      assert.ok(discriminated);
    });

    it('should have discriminator when manually provided (returning schema)', async function() {
      const schema = new Schema('object')
        .unionSchema('optionA', new Schema('object')
          .property('type', new Schema('string').values(['A'])))
        .unionDiscriminator((value, config, location) => {
          return value.type === 'A' ? location.schema.unionSchemas.optionA : undefined;
        });

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, true);
      const discriminated = await compiled._discriminateUnion({type: 'A'}, {});
      assert.ok(discriminated);
    });

    it('should have discriminator when manually provided (returning key)', async function() {
      const schema = new Schema('object')
        .unionSchema('optionB', new Schema('object')
          .property('type', new Schema('string').values(['B'])))
        .unionDiscriminator((value) => {
          return value.type === 'B' ? 'optionB' : undefined;
        });

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, true);
      const discriminated = await compiled._discriminateUnion({type: 'B'}, {});
      assert.ok(discriminated);
      assert.strictEqual(compiled.findUnionKey(discriminated), 'optionB');
    });

    it('should not have discriminator when isUnion is false', async function() {
      const schema = new Schema('object')
        .property('regular', new Schema('string'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, false);
    });
  });

  describe('Union schemas object structure', function() {

    it('should _freeze unionSchemas object after compilation', async function() {
      const schema = new Schema('object')
        .unionSchema('option', new Schema('object')
          .property('type', new Schema('string').values(['option'])));

      const compiled = await resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.unionSchemas));
    });

    it('should _freeze each compiled union schema', async function() {
      const schema = new Schema('object')
        .unionSchema('a', new Schema('object').property('type', new Schema('string').values(['a'])))
        .unionSchema('b', new Schema('object').property('type', new Schema('string').values(['b'])));

      const compiled = await resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.unionSchemas.a));
      assert.ok(Object.isFrozen(compiled.unionSchemas.b));
    });

    it('should preserve union schema keys', async function() {
      const schema = new Schema('object')
        .unionSchema('customKey', new Schema('object')
          .property('type', new Schema('string').values(['customKey'])));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.customKey);
      assert.strictEqual(Object.keys(compiled.unionSchemas)[0], 'customKey');
    });

    it('should allow various key formats', async function() {
      const schema = new Schema('object')
        .unionSchema('simple', new Schema('object').property('t', new Schema('string').values(['s'])))
        .unionSchema('with-dashes', new Schema('object').property('t', new Schema('string').values(['d'])))
        .unionSchema('with_underscores', new Schema('object').property('t', new Schema('string').values(['u'])))
        .unionSchema('CamelCase', new Schema('object').property('t', new Schema('string').values(['c'])));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.simple);
      assert.ok(compiled.unionSchemas['with-dashes']);
      assert.ok(compiled.unionSchemas.with_underscores);
      assert.ok(compiled.unionSchemas.CamelCase);
    });
  });

  describe('findUnionKey helper', function() {

    it('should find the key for a union schema', async function() {
      const schema = new Schema('object')
        .unionSchema('myKey', new Schema('object')
          .property('type', new Schema('string').values(['myKey'])));

      const compiled = await resolver.compile(schema);

      const key = compiled.findUnionKey(compiled.unionSchemas.myKey);
      assert.strictEqual(key, 'myKey');
    });

    it('should return undefined for non-existent union schema', async function() {
      const schema = new Schema('object')
        .unionSchema('exists', new Schema('object')
          .property('type', new Schema('string').values(['exists'])));

      const compiled = await resolver.compile(schema);

      const otherSchema = await resolver.compile(new Schema('number'));
      const key = compiled.findUnionKey(otherSchema);
      assert.strictEqual(key, undefined);
    });

    it('should find keys for multiple union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('first', new Schema('object').property('type', new Schema('string').values(['first'])))
        .unionSchema('second', new Schema('object').property('type', new Schema('string').values(['second'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.findUnionKey(compiled.unionSchemas.first), 'first');
      assert.strictEqual(compiled.findUnionKey(compiled.unionSchemas.second), 'second');
    });


  });

  describe('Union schemas with regular properties', function() {

    it('should allow union schemas alongside regular properties', async function() {
      const schema = new Schema('object')
        .property('regular', new Schema('string'))
        .unionSchema('variant', new Schema('object')
          .property('type', new Schema('string').values(['variant']))
          .property('special', new Schema('number')));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.properties.regular);
      assert.ok(compiled.unionSchemas.variant);
      assert.ok(compiled.unionSchemas.variant.properties.special);
    });

    it('should handle both hasChildren and isUnion being true', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .unionSchema('type', new Schema('object')
          .property('kind', new Schema('string').values(['type'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.hasChildren, true);
      assert.strictEqual(compiled.isUnion, true);
    });

    it('should hoist discriminator property making hasChildren true', async function() {
      const schema = new Schema('object')
        .unionSchema('only', new Schema('object')
          .property('type', new Schema('string').values(['only'])));

      const compiled = await resolver.compile(schema);

      // When discriminator properties are hoisted, they become regular properties
      assert.strictEqual(compiled.hasChildren, true);
      assert.strictEqual(compiled.isUnion, true);
      // The hoisted property should exist
      assert.ok(compiled.properties.type);
    });
  });

  describe('Union schema metadata and options', function() {

    it('should preserve metadata in union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('documented', new Schema('object')
          .property('type', new Schema('string').values(['documented']))
          .meta('description', 'A documented variant'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.unionSchemas.documented.metadata.description, 'A documented variant');
    });

    it('should preserve options in union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('required', new Schema('object')
          .property('type', new Schema('string').values(['required']))
          .required(true))
        .unionSchema('optional', new Schema('object')
          .property('type', new Schema('string').values(['optional']))
          .required(false));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.unionSchemas.required.required, true);
      assert.strictEqual(compiled.unionSchemas.optional.required, false);
    });

    it('should preserve defaults in union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('withDefault', new Schema('object')
          .property('type', new Schema('string').values(['withDefault']))
          .default({type: 'withDefault'}));

      const compiled = await resolver.compile(schema);

      assert.deepStrictEqual(compiled.unionSchemas.withDefault.default, {type: 'withDefault'});
    });
  });

  describe('Union schemas with different base types', function() {

    it('should compile union with object schemas having different structures', async function() {
      const schema = new Schema('object')
        .unionSchema('obj1', new Schema('object')
          .property('kind', new Schema('string').values(['obj1']))
          .property('a', new Schema('string')))
        .unionSchema('obj2', new Schema('object')
          .property('kind', new Schema('string').values(['obj2']))
          .property('b', new Schema('number')));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.obj1.properties.a);
      assert.ok(compiled.unionSchemas.obj2.properties.b);
    });

    it('should compile union with array schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('strings', new Schema('object')
          .property('type', new Schema('string').values(['strings']))
          .property('items', new Schema('array')
            .property('*', new Schema('string'))))
        .unionSchema('numbers', new Schema('object')
          .property('type', new Schema('string').values(['numbers']))
          .property('items', new Schema('array')
            .property('*', new Schema('number'))));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled.unionSchemas.strings.properties.items.properties['*']);
      assert.ok(compiled.unionSchemas.numbers.properties.items.properties['*']);
    });
  });

  describe('Union schema inheritance', function() {

    it('should inherit from base schemas in union definitions', async function() {
      const baseObject = new Schema('object')
        .property('type', new Schema('string').values(['base']))
        .meta('category', 'config');

      const schema = new Schema('object')
        .unionSchema('derived', new Schema(baseObject)
          .meta('variant', 'special'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.unionSchemas.derived.metadata.category, 'config');
      assert.strictEqual(compiled.unionSchemas.derived.metadata.variant, 'special');
    });

    it('should resolve base types for properties in union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('typed', new Schema('object')
          .property('kind', new Schema('string').values(['typed']))
          .property('count', new Schema('number')));

      const compiled = await resolver.compile(schema);

      // Should have number base type normalizer
      assert.strictEqual(await compiled.unionSchemas.typed.properties.count._normalizeValue('42'), 42);
    });
  });

  describe('Empty unions', function() {

    it('should handle schema with no union schemas', async function() {
      const schema = new Schema('object')
        .property('regular', new Schema('string'));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, false);
      assert.strictEqual(Object.keys(compiled.unionSchemas).length, 0);
    });

    it('should compile schema with empty unionSchemas object', async function() {
      const schema = new Schema('object');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.isUnion, false);
      assert.ok(compiled.unionSchemas);
      assert.strictEqual(Object.keys(compiled.unionSchemas).length, 0);
    });
  });

  describe('Error conditions', function() {

    it('should throw error when union has no value constraints and no discriminator', async function() {
      const schema = new Schema('object')
        .unionSchema('noValues', new Schema('object')
          .property('field', new Schema('string')));

      await assert.rejects(
      async () => await resolver.compile(schema),
        /Schema needs at least one property with constrained values/
      );
    });

    it('should compile successfully when all union schemas have value constraints', async function() {
      const schema = new Schema('object')
        .unionSchema('optionA', new Schema('object')
          .property('type', new Schema('string').values(['A'])))
        .unionSchema('optionB', new Schema('object')
          .property('type', new Schema('string').values(['B'])));

      const compiled = await resolver.compile(schema);

      assert.ok(compiled);
      assert.strictEqual(compiled.isUnion, true);
    });
  });

  describe('Union schema count', function() {

    it('should handle two union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('a', new Schema('object').property('type', new Schema('string').values(['a'])))
        .unionSchema('b', new Schema('object').property('type', new Schema('string').values(['b'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(Object.keys(compiled.unionSchemas).length, 2);
    });

    it('should handle many union schemas', async function() {
      const schema = new Schema('object')
        .unionSchema('opt1', new Schema('object').property('type', new Schema('string').values(['opt1'])))
        .unionSchema('opt2', new Schema('object').property('type', new Schema('string').values(['opt2'])))
        .unionSchema('opt3', new Schema('object').property('type', new Schema('string').values(['opt3'])))
        .unionSchema('opt4', new Schema('object').property('type', new Schema('string').values(['opt4'])))
        .unionSchema('opt5', new Schema('object').property('type', new Schema('string').values(['opt5'])));

      const compiled = await resolver.compile(schema);

      assert.strictEqual(Object.keys(compiled.unionSchemas).length, 5);
      assert.strictEqual(compiled.isUnion, true);
    });
  });
});