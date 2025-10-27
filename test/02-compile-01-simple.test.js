
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { CompiledSchema } from '../src/schema/compiled-schema.js';

describe('Schema Compilation - Simple', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic compilation without base type', function() {

    it('should compile a simple schema without a base type', function() {
      const schema = new Schema()
        .property('name', new Schema('string'))
        .property('age', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.ok(compiled instanceof CompiledSchema);
      assert.ok(compiled.properties.name instanceof CompiledSchema);
      assert.ok(compiled.properties.age instanceof CompiledSchema);
    });

    it('should compile properties with the correct metadata', function() {
      const schema = new Schema()
        .property('name', new Schema('string')
          .meta('description', 'User name')
          .meta('flagHint', 'N'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.name.metadata.description, 'User name');
      assert.strictEqual(compiled.properties.name.metadata.flagHint, 'N');
    });

    it('should compile properties with the correct options', function() {
      const schema = new Schema()
        .property('email', new Schema('string')
          .required(true)
          .default('user@example.com'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.email.required, true);
      assert.strictEqual(compiled.properties.email.default, 'user@example.com');
    });

    it('should compile nested properties', function() {
      const schema = new Schema()
        .property('user', new Schema('object')
          .property('name', new Schema('string'))
          .property('contact', new Schema('object')
            .property('email', new Schema('string'))
            .property('phone', new Schema('string'))));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.user instanceof CompiledSchema);
      assert.ok(compiled.properties.user.properties.name instanceof CompiledSchema);
      assert.ok(compiled.properties.user.properties.contact instanceof CompiledSchema);
      assert.ok(compiled.properties.user.properties.contact.properties.email instanceof CompiledSchema);
      assert.ok(compiled.properties.user.properties.contact.properties.phone instanceof CompiledSchema);
    });
  });

  describe('Compiled schema functions', function() {

    it('should have compiled normalizer functions', function() {
      const schema = new Schema()
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.name.options.normalizer, 'function');
    });

    it('should have compiled transformer functions', function() {
      const schema = new Schema()
        .property('count', new Schema('number'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.count.options.transformer, 'function');
    });

    it('should have compiled validator functions', function() {
      const schema = new Schema()
        .property('active', new Schema('boolean'));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.active.options.validator, 'function');
    });

    it('should compile custom normalizer functions', function() {
      const customNormalizer = (value) => String(value).toUpperCase();
      const schema = new Schema()
        .property('code', new Schema('string')
          .normalizer(customNormalizer));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.code.options.normalizer, 'function');
      assert.strictEqual(compiled.properties.code.normalize('test'), 'TEST');
    });

    it('should compile custom transformer functions', async function() {
      const customTransformer = (value) => `transformed-${value}`;
      const schema = new Schema()
        .property('tag', new Schema('string')
          .transformer(customTransformer));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.tag.options.transformer, 'function');
      const result = await compiled.properties.tag.transform('input', {}, 'tag');
      assert.strictEqual(result, 'transformed-input');
    });

    it('should compile custom validator functions', async function() {
      const customValidator = (value) => {
        if (value.length < 3) {
          throw new Error('Too short');
        }
        return value;
      };
      const schema = new Schema()
        .property('username', new Schema('string')
          .validator(customValidator));

      const compiled = resolver.compile(schema);

      assert.strictEqual(typeof compiled.properties.username.options.validator, 'function');
      await assert.rejects(
        () => compiled.properties.username.options.validator('ab', {}, compiled.properties.username, 'username'),
        /Too short/
      );
    });
  });

  describe('Compiled schema immutability', function() {

    it('should freeze the compiled schema', function() {
      const schema = new Schema()
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled));
    });

    it('should freeze compiled properties', function() {
      const schema = new Schema()
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.properties));
    });

    it('should freeze compiled options', function() {
      const schema = new Schema()
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.options));
      assert.ok(Object.isFrozen(compiled.properties.name.options));
    });

    it('should freeze compiled metadata', function() {
      const schema = new Schema()
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);

      assert.ok(Object.isFrozen(compiled.metadata));
      assert.ok(Object.isFrozen(compiled.properties.name.metadata));
    });
  });

  describe('Parent and name tracking in compiled schemas', function() {

    it('should set parent references correctly', function() {
      const schema = new Schema()
        .property('user', new Schema('object')
          .property('name', new Schema('string')));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.user.parent, compiled);
      assert.strictEqual(compiled.properties.user.properties.name.parent, compiled.properties.user);
    });

    it('should set name references correctly', function() {
      const schema = new Schema()
        .property('user', new Schema('object')
          .property('name', new Schema('string')));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.properties.user.name, 'user');
      assert.strictEqual(compiled.properties.user.properties.name.name, 'name');
    });

    it('should generate correct paths', function() {
      const schema = new Schema()
        .property('user', new Schema('object')
          .property('profile', new Schema('object')
            .property('name', new Schema('string'))));

      const compiled = resolver.compile(schema);

      assert.strictEqual(compiled.path, '');
      assert.strictEqual(compiled.properties.user.path, 'user');
      assert.strictEqual(compiled.properties.user.properties.profile.path, 'user.profile');
      assert.strictEqual(compiled.properties.user.properties.profile.properties.name.path, 'user.profile.name');
    });
  });

  describe('Values compilation', function() {

    it('should compile and normalize values', function() {
      const schema = new Schema()
        .property('status', new Schema('string')
          .values(['active', 'inactive', 'pending']));

      const compiled = resolver.compile(schema);

      assert.deepStrictEqual(compiled.properties.status.values, ['active', 'inactive', 'pending']);
    });

    it('should normalize values during compilation', function() {
      const schema = new Schema()
        .property('count', new Schema('number')
          .values(['1', '2', '3']));

      const compiled = resolver.compile(schema);

      // Numbers should be normalized from strings
      assert.deepStrictEqual(compiled.properties.count.values, [1, 2, 3]);
    });
  });

  describe('Multiple property compilation', function() {

    it('should compile multiple properties using fluent syntax', function() {
      const schema = new Schema()
        .property('name', new Schema('string').required(true))
        .property('age', new Schema('number').default(0))
        .property('email', new Schema('string'))
        .property('active', new Schema('boolean').default(true));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.name instanceof CompiledSchema);
      assert.ok(compiled.properties.age instanceof CompiledSchema);
      assert.ok(compiled.properties.email instanceof CompiledSchema);
      assert.ok(compiled.properties.active instanceof CompiledSchema);

      assert.strictEqual(compiled.properties.name.required, true);
      assert.strictEqual(compiled.properties.age.default, 0);
      assert.strictEqual(compiled.properties.active.default, true);
    });

    it('should compile array properties', function() {
      const schema = new Schema()
        .property('tags', new Schema('array')
          .property('*', new Schema('string')));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.tags instanceof CompiledSchema);
      assert.ok(compiled.properties.tags.properties['*'] instanceof CompiledSchema);
      assert.strictEqual(compiled.properties.tags.isArray, true);
    });

    it('should compile object properties with mixed types', function() {
      const schema = new Schema()
        .property('config', new Schema('object')
          .property('name', new Schema('string'))
          .property('version', new Schema('number'))
          .property('enabled', new Schema('boolean'))
          .property('tags', new Schema('array')
            .property('*', new Schema('string'))));

      const compiled = resolver.compile(schema);

      assert.ok(compiled.properties.config.properties.name instanceof CompiledSchema);
      assert.ok(compiled.properties.config.properties.version instanceof CompiledSchema);
      assert.ok(compiled.properties.config.properties.enabled instanceof CompiledSchema);
      assert.ok(compiled.properties.config.properties.tags instanceof CompiledSchema);
      assert.ok(compiled.properties.config.properties.tags.properties['*'] instanceof CompiledSchema);
    });
  });
});
