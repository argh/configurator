
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaError } from '../src/errors.js';

describe('Schema - Basic Construction', function() {

  describe('Constructor variations', function() {

    it('should create an empty schema with no arguments', function() {
      const schema = new Schema();
      assert.ok(schema instanceof Schema);
      assert.strictEqual(schema.base, undefined);
      assert.deepStrictEqual(schema.properties, {});
      assert.deepStrictEqual(schema.options, {});
      assert.deepStrictEqual(schema.metadata, {});
    });

    it('should create a schema with a base type string', function() {
      const schema = new Schema('string');
      assert.strictEqual(schema.base, 'string');

      const numSchema = new Schema('number');
      assert.strictEqual(numSchema.base, 'number');

      const boolSchema = new Schema('boolean');
      assert.strictEqual(boolSchema.base, 'boolean');

      const objSchema = new Schema('object');
      assert.strictEqual(objSchema.base, 'object');

      const arrSchema = new Schema('array');
      assert.strictEqual(arrSchema.base, 'array');
    });

    it('should create a schema with base type and options', function() {
      const schema = new Schema('string', {
        required: true,
        default: 'test',
        _description: 'A test string'
      });

      assert.strictEqual(schema.base, 'string');
      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.options.default, 'test');
      assert.strictEqual(schema.metadata.description, 'A test string');
    });

    it('should create a schema from a SchemaData object', function() {
      const schema = new Schema({
        options: {
          required: true,
          default: 42,
          validator: '$number'
        }
      });

      assert.strictEqual(schema.base, undefined);
      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.options.default, 42);
      assert.strictEqual(schema.options.validator, '$number');
    });

    it('should create a schema by extending another Schema', function() {
      const baseSchema = new Schema('string', {
        options: {
          required: true
        },
        metadata: {
          description: 'Base schema'
        }
      });

      const extendedSchema = new Schema(baseSchema, {
        options: {
          default: 'extended'
        }
      });

      assert.strictEqual(extendedSchema.base, 'string');
      assert.strictEqual(extendedSchema.options.required, true);
      assert.strictEqual(extendedSchema.metadata.description, 'Base schema');
      assert.strictEqual(extendedSchema.options.default, 'extended');
    });
  });

  describe('Static factory methods', function() {

    it('should create schema using Schema.create()', function() {
      const schema = Schema.create('number', { default: 10 });
      assert.ok(schema instanceof Schema);
      assert.strictEqual(schema.base, 'number');
      assert.strictEqual(schema.options.default, 10);
    });

    it('should create literal schemas using Schema.literal()', function() {
      const strLiteral = Schema.literal('hello');
      assert.strictEqual(strLiteral.base, 'string');
      assert.deepStrictEqual(strLiteral.options.values, ['hello']);
      assert.strictEqual(strLiteral.options.default, 'hello');

      const numLiteral = Schema.literal(42);
      assert.strictEqual(numLiteral.base, 'number');
      assert.deepStrictEqual(numLiteral.options.values, [42]);

      const boolLiteral = Schema.literal(true);
      assert.strictEqual(boolLiteral.base, 'boolean');
      assert.deepStrictEqual(boolLiteral.options.values, [true]);
    });

    it('should create schema from model using Schema.createFromModel()', function() {
      const original = new Schema('object')
        .property('name', new Schema('string'))
        .option('required', true)
        .meta('description', 'Test model');

      const copy = Schema.createFromModel(original);

      assert.notStrictEqual(copy, original);
      assert.strictEqual(copy.base, 'object');
      assert.strictEqual(copy.options.required, true);
      assert.strictEqual(copy.metadata.description, 'Test model');
      assert.ok(copy.properties.name instanceof Schema);
    });

    it('should round-trip toData() -> createFromModel()', function() {
      const original = new Schema('object')
        .property('name', new Schema('string', { required: true, default: 'test' }))
        .property('age', new Schema('number', { _description: 'User age' }))
        .property('active', new Schema('boolean'))
        .option('strict', false)
        .meta('description', 'User object');

      const data = original.toData();
      const restored = Schema.createFromModel(data);

      assert.strictEqual(restored.base, 'object');
      assert.strictEqual(restored.options.strict, false);
      assert.strictEqual(restored.metadata.description, 'User object');

      // Check properties
      assert.ok(restored.properties.name instanceof Schema);
      assert.strictEqual(restored.properties.name.base, 'string');
      assert.strictEqual(restored.properties.name.options.required, true);
      assert.strictEqual(restored.properties.name.options.default, 'test');

      assert.ok(restored.properties.age instanceof Schema);
      assert.strictEqual(restored.properties.age.base, 'number');
      assert.strictEqual(restored.properties.age.metadata.description, 'User age');

      assert.ok(restored.properties.active instanceof Schema);
      assert.strictEqual(restored.properties.active.base, 'boolean');
    });

    it('should round-trip nested schemas with toData() -> createFromModel()', function() {
      const original = new Schema('object')
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('name', new Schema('string'))
            .property('email', new Schema('string'))
          )
          .property('settings', new Schema('object')
            .property('theme', new Schema('string', { default: 'dark' }))
          )
        )
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const data = original.toData();
      const restored = Schema.createFromModel(data);

      // Check nested structure
      assert.ok(restored.properties.user instanceof Schema);
      assert.ok(restored.properties.user.properties.profile instanceof Schema);
      assert.ok(restored.properties.user.properties.profile.properties.name instanceof Schema);
      assert.strictEqual(restored.properties.user.properties.profile.properties.name.base, 'string');

      assert.ok(restored.properties.user.properties.settings instanceof Schema);
      assert.ok(restored.properties.user.properties.settings.properties.theme instanceof Schema);
      assert.strictEqual(restored.properties.user.properties.settings.properties.theme.options.default, 'dark');

      // Check array with wildcard
      assert.ok(restored.properties.tags instanceof Schema);
      assert.strictEqual(restored.properties.tags.base, 'array');
      assert.ok(restored.properties.tags.properties['*'] instanceof Schema);
      assert.strictEqual(restored.properties.tags.properties['*'].base, 'string');
    });

    it('should round-trip union schemas with toData() -> createFromModel()', function() {
      const original = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .unionSchema('text', new Schema('object')
              .property('type', new Schema('string').values(['text']))
              .property('content', new Schema('string'))
            )
            .unionSchema('image', new Schema('object')
              .property('type', new Schema('string').values(['image']))
              .property('url', new Schema('string'))
              .property('alt', new Schema('string'))
            )
          )
        );

      const data = original.toData();
      const restored = Schema.createFromModel(data);

      // Check union structure
      const itemSchema = restored.properties.items.properties['*'];
      assert.ok(itemSchema instanceof Schema);
      assert.ok(itemSchema.unionSchemas);
      assert.ok(itemSchema.unionSchemas.text instanceof Schema);
      assert.ok(itemSchema.unionSchemas.image instanceof Schema);

      // Check text union member
      assert.ok(itemSchema.unionSchemas.text.properties.type instanceof Schema);
      assert.deepStrictEqual(itemSchema.unionSchemas.text.properties.type.options.values, ['text']);
      assert.ok(itemSchema.unionSchemas.text.properties.content instanceof Schema);

      // Check image union member
      assert.ok(itemSchema.unionSchemas.image.properties.type instanceof Schema);
      assert.deepStrictEqual(itemSchema.unionSchemas.image.properties.type.options.values, ['image']);
      assert.ok(itemSchema.unionSchemas.image.properties.url instanceof Schema);
      assert.ok(itemSchema.unionSchemas.image.properties.alt instanceof Schema);
    });

    it('should round-trip with custom options and metadata', function() {
      const customValidator = (value) => value.length > 0;
      const customTransformer = (value) => value.toUpperCase();

      const original = new Schema('string', {
        validator: customValidator,
        transformer: customTransformer,
        required: true,
        default: 'test',
        _description: 'Custom field',
        _flagHint: 'c'
      });

      const data = original.toData();
      const restored = Schema.createFromModel(data);

      assert.strictEqual(restored.base, 'string');
      assert.strictEqual(restored.options.required, true);
      assert.strictEqual(restored.options.default, 'test');
      assert.strictEqual(restored.metadata.description, 'Custom field');
      assert.strictEqual(restored.metadata.flagHint, 'c');
    });
  });

  describe('SchemaData shape via constructor', function() {

    it('should set options via options object', function() {
      const schema = new Schema({
        options: {
          required: true,
          strict: false,
          default: 'value'
        }
      });

      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.options.strict, false);
      assert.strictEqual(schema.options.default, 'value');
    });

    it('should set metadata via metadata object', function() {
      const schema = new Schema({
        metadata: {
          description: 'A description',
          flagHint: 'D',
          advanced: true
        }
      });

      assert.strictEqual(schema.metadata.description, 'A description');
      assert.strictEqual(schema.metadata.flagHint, 'D');
      assert.strictEqual(schema.metadata.advanced, true);
    });

    it('should set base via base property', function() {
      const schema = new Schema({
        base: 'number',
        options: {
          default: 10
        }
      });

      assert.strictEqual(schema.base, 'number');
      assert.strictEqual(schema.options.default, 10);
    });

    it('should set properties via properties object', function() {
      const schema = new Schema({
        base: 'object',
        properties: {
          name: { base: 'string' },
          age: { base: 'number' }
        }
      });

      assert.ok(schema.properties.name instanceof Schema);
      assert.strictEqual(schema.properties.name.base, 'string');
      assert.ok(schema.properties.age instanceof Schema);
      assert.strictEqual(schema.properties.age.base, 'number');
    });

    it('should combine options and metadata', function() {
      const schema = new Schema({
        base: 'string',
        options: {
          required: true,
          strict: false,
          default: 'test'
        },
        metadata: {
          description: 'Test description',
          flagHint: 'T',
          advanced: true
        }
      });

      assert.strictEqual(schema.base, 'string');
      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.options.strict, false);
      assert.strictEqual(schema.options.default, 'test');
      assert.strictEqual(schema.metadata.description, 'Test description');
      assert.strictEqual(schema.metadata.flagHint, 'T');
      assert.strictEqual(schema.metadata.advanced, true);
    });

    it('should handle values in options', function() {
      const schema = new Schema({
        base: 'string',
        options: {
          values: ['option1', 'option2']
        }
      });

      assert.ok(Array.isArray(schema.options.values));
      assert.deepStrictEqual(schema.options.values, ['option1', 'option2']);
    });
  });

  describe('Fluent chaining', function() {

    it('should support method chaining for property definitions', function() {
      const schema = new Schema('object')
        .property('field1', new Schema('string'))
        .property('field2', new Schema('number'))
        .property('field3', new Schema('boolean'));

      assert.ok(schema.properties.field1 instanceof Schema);
      assert.ok(schema.properties.field2 instanceof Schema);
      assert.ok(schema.properties.field3 instanceof Schema);
    });

    it('should support method chaining for options', function() {
      const schema = new Schema('string')
        .required(true)
        .default('test')
        .strict(false);

      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.options.default, 'test');
      assert.strictEqual(schema.options.strict, false);
    });

    it('should support method chaining for metadata', function() {
      const schema = new Schema('string')
        .meta('description', 'A field')
        .meta('flagHint', 'F')
        .meta('advanced', true);

      assert.strictEqual(schema.metadata.description, 'A field');
      assert.strictEqual(schema.metadata.flagHint, 'F');
      assert.strictEqual(schema.metadata.advanced, true);
    });

    it('should support mixed method chaining', function() {
      const schema = new Schema('object')
        .meta('description', 'User object')
        .required(true)
        .property('name', new Schema('string').required(true))
        .property('age', new Schema('number').default(0));

      assert.strictEqual(schema.metadata.description, 'User object');
      assert.strictEqual(schema.options.required, true);
      assert.strictEqual(schema.properties.name.options.required, true);
      assert.strictEqual(schema.properties.age.options.default, 0);
    });
  });

  describe('Clone and extend', function() {

    it('should clone a schema with all attributes', function() {
      const original = new Schema('string', {
        required: true,
        default: 'test',
        _description: 'Original'
      });

      const cloned = original.clone();

      assert.notStrictEqual(cloned, original);
      assert.strictEqual(cloned.base, 'string');
      assert.strictEqual(cloned.options.required, true);
      assert.strictEqual(cloned.options.default, 'test');
      assert.strictEqual(cloned.metadata.description, 'Original');
    });

    it('should clone a schema with properties', function() {
      const original = new Schema('object')
        .property('field1', new Schema('string'))
        .property('field2', new Schema('number'));

      const cloned = original.clone();

      assert.notStrictEqual(cloned, original);
      assert.ok(cloned.properties.field1 instanceof Schema);
      assert.ok(cloned.properties.field2 instanceof Schema);
      assert.notStrictEqual(cloned.properties.field1, original.properties.field1);
    });

    it('should extend a schema without overwriting existing attributes', function() {
      const base = new Schema('string', {
        required: true,
        _description: 'Base'
      });

      const extended = new Schema('string', {
        default: 'new',
        _flagHint: 'E'
      });

      extended.extend(base);

      // Extended schema should keep its own attributes
      assert.strictEqual(extended.options.default, 'new');
      assert.strictEqual(extended.metadata.flagHint, 'E');
      // But gain the base schema's attributes that it didn't have
      assert.strictEqual(extended.options.required, true);
      assert.strictEqual(extended.metadata.description, 'Base');
    });

    it('should extend properties without overwriting', function() {
      const base = new Schema('object')
        .property('shared', new Schema('string').default('base'))
        .property('baseOnly', new Schema('number'));

      const extended = new Schema('object')
        .property('shared', new Schema('string').default('extended'));

      extended.extend(base);

      // Extended should keep its own version of 'shared'
      assert.strictEqual(extended.properties.shared.options.default, 'extended');
      // But gain 'baseOnly' from base
      assert.ok(extended.properties.baseOnly instanceof Schema);
      assert.strictEqual(extended.properties.baseOnly.base, 'number');
    });
  });
});