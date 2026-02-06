
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { assertErrorMessageInCauseChain, SchemaError } from '../src/errors.js';

describe('Schema Compilation - Base Type Resolution', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Built-in base type registration', function() {

    it('should have string base type registered', function() {
      const baseSchema = resolver.getSchema('string');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'string');
    });

    it('should have number base type registered', function() {
      const baseSchema = resolver.getSchema('number');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'number');
    });

    it('should have boolean base type registered', function() {
      const baseSchema = resolver.getSchema('boolean');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'boolean');
    });

    it('should have object base type registered', function() {
      const baseSchema = resolver.getSchema('object');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'object');
    });

    it('should have array base type registered', function() {
      const baseSchema = resolver.getSchema('array');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'array');
    });

    it('should have date base type registered', function() {
      const baseSchema = resolver.getSchema('date');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'date');
    });

    it('should have buffer base type registered', function() {
      const baseSchema = resolver.getSchema('buffer');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'buffer');
    });

    it('should have any base type registered', function() {
      const baseSchema = resolver.getSchema('any');
      assert.ok(baseSchema instanceof Schema);
      assert.strictEqual(baseSchema.options.type, 'any');
    });
  });

  describe('Base type lookup with case normalization', function() {

    it('should normalize base type names to kebab-case', function() {
      const schema1 = resolver.getSchema('string');
      const schema2 = resolver.getSchema('String');
      const schema3 = resolver.getSchema('STRING');

      // All should resolve to the same schema
      assert.strictEqual(schema1, schema2);
      assert.strictEqual(schema2, schema3);
    });

    it('should handle camelCase base type names', function() {
      // Register a custom schema with camelCase
      const customSchema = new Schema({ type: 'custom' });
      resolver.registerSchema('myCustomType', customSchema);

      // Should be able to retrieve with various casings
      const retrieved1 = resolver.getSchema('myCustomType');
      const retrieved2 = resolver.getSchema('my-custom-type');

      assert.strictEqual(retrieved1, customSchema);
      assert.strictEqual(retrieved2, customSchema);
    });
  });

  describe('Custom base type registration', function() {

    it('should allow registering custom base types', function() {
      const customSchema = new Schema({
        type: 'email',
        normalizer: (v) => String(v).toLowerCase(),
        validator: (v) => {
          if (!v.includes('@')) throw new Error('Invalid email');
          return v;
        }
      });

      resolver.registerSchema('email', customSchema);

      const retrieved = resolver.getSchema('email');
      assert.strictEqual(retrieved, customSchema);
    });

    it('should only accept Schema instances for registration', function() {
      assert.throws(
        () => resolver.registerSchema('invalid', { type: 'invalid' }),
        /Registry can only store Schema instances/
      );

      assert.throws(
        () => resolver.registerSchema('invalid', 'not a schema'),
        /Registry can only store Schema instances/
      );
    });

    it('should allow overriding built-in base types', function() {
      const customString = new Schema({
        type: 'string',
        normalizer: (v) => String(v).toUpperCase()
      });

      resolver.registerSchema('string', customString);

      const retrieved = resolver.getSchema('string');
      assert.strictEqual(retrieved, customString);
    });
  });

  describe('Schema resolution during compilation', function() {

    it('should resolve base type and inherit its properties', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      // Should have inherited the normalizer from string base type
      assert.strictEqual(await compiled._normalizeValue(123), '123');
    });

    it('should resolve base type and inherit validator', async function() {
      const schema = new Schema('number');
      const compiled = await resolver.compile(schema);

      // Should have inherited the validator from number base type
      const result = await compiled._validateValue(42);
      assert.strictEqual(result, 42);
    });

    it('should resolve base type and inherit transformer', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      // Should have inherited transformer
      const result = await compiled._transformValue(true);
      assert.strictEqual(result, true);
    });

    it('should handle schema without base type', async function() {
      const schema = new Schema();
      const compiled = await resolver.compile(schema);

      // Should compile with 'any' as default base
      assert.ok(compiled);
    });

    it('should throw for unknown base types', async function() {
      const schema = new Schema('nonexistent-type');

      await assert.rejects(
      async () => await resolver.compile(schema),
        (error) => assertErrorMessageInCauseChain(error, /Unable to resolve "nonexistent-type"/)
      );
    });
  });

  describe('Metadata inheritance from base types', function() {

    it('should inherit valueName from base type', async function() {
      const schema = new Schema('string');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueName, 'string');
    });

    it('should inherit valueDescription from boolean base type', async function() {
      const schema = new Schema('boolean');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.valueDescription, '[true|false]');
    });

    it('should inherit parserTypeHint from date base type', async function() {
      const schema = new Schema('date');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.metadata.parserTypeHint, 'string');
    });

    it('should not override local metadata with base metadata', async function() {
      const schema = new Schema('string')
        .meta('valueName', 'custom-name');

      const compiled = await resolver.compile(schema);

      // Local metadata should take precedence
      assert.strictEqual(compiled.metadata.valueName, 'custom-name');
    });
  });

  describe('Options inheritance from base types', function() {

    it('should inherit type option from base', async function() {
      const schema = new Schema('array');
      const compiled = await resolver.compile(schema);

      assert.strictEqual(compiled.options.type, 'array');
    });

    it('should not override local options with base options', async function() {
      const customNormalizer = (v) => `custom-${v}`;
      const schema = new Schema('string')
        .normalizer(customNormalizer);

      const compiled = await resolver.compile(schema);

      // Local normalizer should take precedence
      assert.strictEqual(await compiled._normalizeValue('test'), 'custom-test');
    });
  });

  describe('Nested schema resolution', function() {

    it('should resolve base types for nested property schemas', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = await resolver.compile(schema);

      // Nested schemas should have resolved their base types
      assert.strictEqual(await compiled.properties.name._normalizeValue(123), '123');
      assert.strictEqual(await compiled.properties.age._normalizeValue('456'), 456);
    });

    it('should resolve base types at multiple levels of nesting', async function() {
      const schema = new Schema('object')
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
          .property('active', new Schema('boolean')));

      const compiled = await resolver.compile(schema);

      // Deep nested schemas should resolve their base types
      const nameSchema = compiled.properties.user.properties.name;
      const activeSchema = compiled.properties.user.properties.active;

      assert.strictEqual(await nameSchema._normalizeValue(123), '123');
      assert.strictEqual(await activeSchema._normalizeValue('true'), true);
    });
  });

  describe('Resolution chain', function() {

    it('should follow resolution chain for Schema base', async function() {
      const baseSchema = new Schema('string')
        .meta('category', 'text');

      const schema = new Schema(baseSchema)
        .meta('description', 'Extended string');

      const compiled = await resolver.compile(schema);

      // Should have metadata from both base schema and ultimate base type
      assert.strictEqual(compiled.metadata.category, 'text');
      assert.strictEqual(compiled.metadata.description, 'Extended string');
      assert.strictEqual(compiled.metadata.valueName, 'string');
    });

    it('should resolve through multiple Schema layers', async function() {
      const level1 = new Schema('number');
      const level2 = new Schema(level1).meta('level', 2);
      const level3 = new Schema(level2).meta('level', 3);

      const compiled = await resolver.compile(level3);

      // Should resolve through all layers to number base type
      assert.strictEqual(await compiled._normalizeValue('42'), 42);
      // Local metadata should win
      assert.strictEqual(compiled.metadata.level, '3');
    });
  });

  describe('Base type registration chain', function() {

    it('should maintain independent resolver instances', async function() {
      const resolver1 = new SchemaResolver();
      const resolver2 = new SchemaResolver();

      const custom1 = new Schema({ type: 'custom1' });
      resolver1.registerSchema('custom', custom1);

      // resolver2 should not have resolver1's custom schema
      assert.throws(
        () => resolver2.getSchema('custom'),
        /Unable to resolve "custom"/
      );
    });

    it('should not affect other resolvers when registering schemas', async function() {
      const resolver1 = new SchemaResolver();
      const resolver2 = new SchemaResolver();

      const custom = new Schema({ type: 'custom' });
      resolver1.registerSchema('newtype', custom);

      const schema = new Schema('newtype');

      // Should compile with resolver1
      const compiled1 = await resolver1.compile(schema);
      assert.ok(compiled1);

      // Should fail with resolver2
      await assert.rejects(
      async () => await resolver2.compile(schema),
        error => assertErrorMessageInCauseChain(error, /Unable to resolve "newtype"/)
      );
    });
  });

  describe('Registry error handling', function() {

    it('should throw descriptive error for missing base type', async function() {
      const schema = new Schema('missing-type');

      await assert.rejects(
      async () => await resolver.compile(schema),

        error => assertErrorMessageInCauseChain(error, /Unable to resolve "missing-type"/)
      );
    });
    it('should not throw for missing base type in lax mode', async function() {
      const schema = new Schema('missing-type').lax();

      const compiled = await resolver.compile(schema);
      assert.ok(compiled);
    });

    it('should throw error when registering non-Schema', function() {
      try {
        resolver.registerSchema('bad', null);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('Schema instances'));
      }
    });
  });
});
