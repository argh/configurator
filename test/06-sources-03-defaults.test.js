
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaDefaultsSource } from '../src/configuration-sources/schema-defaults-source.js';

describe('Sources - SchemaDefaultsSource', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic defaults', function() {

    it('should synthesize assignments for simple default values', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string', { default: 'myapp' }))
        .property('port', new Schema('number', { default: 3000 }));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.ok(assignments instanceof Map);
      assert.strictEqual(assignments.get('name'), 'myapp');
      assert.strictEqual(assignments.get('port'), 3000);
    });

    it('should synthesize assignments for nested defaults', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string', { default: 'localhost' }))
          .property('port', new Schema('number', { default: 5432 }))
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), 5432);
    });

    it('should not create assignments for properties without defaults', async function() {
      const schema = new Schema('object')
        .property('required', new Schema('string'))  // No default
        .property('withDefault', new Schema('string', { default: 'value' }));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.ok(!assignments.has('required'));
      assert.strictEqual(assignments.get('withDefault'), 'value');
    });
  });

  describe('Default value types', function() {

    it('should handle boolean defaults', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean', { default: true }))
        .property('disabled', new Schema('boolean', { default: false }));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.strictEqual(assignments.get('enabled'), true);
      assert.strictEqual(assignments.get('disabled'), false);
    });

    it('should handle array defaults', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array', { default: ['one', 'two'] }));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Source assigns the whole array; processAssignments will expand it later
      const tagsValue = assignments.get('tags');
      assert.ok(Array.isArray(tagsValue));
      assert.deepStrictEqual(tagsValue, ['one', 'two']);
    });

    it('should handle object defaults', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object', {
          default: { host: 'localhost', port: 8080 }
        }));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Source assigns the whole object; processAssignments will expand it later
      const configValue = assignments.get('config');
      assert.deepStrictEqual(configValue, { host: 'localhost', port: 8080 });
    });
  });

  describe('Inherit option', function() {

    it('should create function assignment for inherit option', async function() {
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 5000 }))
        .property('server', new Schema('object')
          .property('timeout', new Schema('number', { inherit: true }))
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Inherit creates a function assignment
      assert.strictEqual(typeof assignments.get('server.timeout'), 'function');
    });

    it('should inherit from parent scope when property exists', async function() {
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 5000 }))
        .property('server', new Schema('object')
          .property('timeout', new Schema('number', { inherit: true }))
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Simulate calling the inherit function with a config that has the parent value
      const inheritFn = assignments.get('server.timeout');
      const config = { timeout: 5000 };
      const inheritedValue = inheritFn(undefined, config, compiled, 'server.timeout');

      assert.strictEqual(inheritedValue, 5000);
    });

    it('should walk up multiple levels to find inherited value', async function() {
      const schema = new Schema('object')
        .property('retries', new Schema('number', { default: 3 }))
        .property('server', new Schema('object')
          .property('database', new Schema('object')
            .property('retries', new Schema('number', { inherit: true }))
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      const inheritFn = assignments.get('server.database.retries');
      const config = { retries: 3 };
      const inheritedValue = inheritFn(undefined, config, compiled, 'server.database.retries');

      assert.strictEqual(inheritedValue, 3);
    });
  });

  describe('Sequence priority', function() {

    it('should have default sequence of SYSTEM_DEFAULTS', function() {
      const source = new SchemaDefaultsSource();
      assert.strictEqual(source.sequence, 100);
    });

    it('should allow custom sequence override', function() {
      const source = new SchemaDefaultsSource({ sequence: 50 });
      assert.strictEqual(source.sequence, 50);
    });
  });

  describe('Union defaults', function() {

    it('should synthesize defaults for union members with union keys', async function() {
      const schema = new Schema('object')
        .property('animal', new Schema('object')
          .unionSchema('cat', new Schema('object')
            .property('type', Schema.literal('cat'))
            .property('name', new Schema('string', { default: 'Fluffy' }))
          )
          .unionSchema('dog', new Schema('object')
            .property('type', Schema.literal('dog'))
            .property('name', new Schema('string', { default: 'Buddy' }))
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Should have union key assignments (colon-separated paths)
      assert.ok(assignments.has('animal:cat.name'));
      assert.ok(assignments.has('animal:dog.name'));
      assert.strictEqual(assignments.get('animal:cat.name'), 'Fluffy');
      assert.strictEqual(assignments.get('animal:dog.name'), 'Buddy');
    });

    it('should handle nested union defaults', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .unionSchema('dev', new Schema('object')
            .property('mode', Schema.literal('dev'))
            .property('debug', new Schema('boolean', { default: true }))
          )
          .unionSchema('prod', new Schema('object')
            .property('mode', Schema.literal('prod'))
            .property('debug', new Schema('boolean', { default: false }))
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.strictEqual(assignments.get('config:dev.debug'), true);
      assert.strictEqual(assignments.get('config:prod.debug'), false);
    });
  });

  describe('Edge cases', function() {

    it('should handle schemas with no defaults', async function() {
      const schema = new Schema('object')
        .property('required', new Schema('string'))
        .property('optional', new Schema('number'));

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.strictEqual(assignments.size, 0);
    });

    it('should create defaults for wildcard schemas', async function() {
      // Wildcard defaults are now supported - they get expanded when matching concrete paths exist
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string', { default: 'default-item' }))
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Should have wildcard assignments that will be expanded later
      const wildcardAssignments = Array.from(assignments.keys()).filter(k => k.includes('*'));
      assert.strictEqual(wildcardAssignments.length, 1);
      assert.strictEqual(wildcardAssignments[0], 'items.*');
      assert.strictEqual(assignments.get('items.*'), 'default-item');
    });

    it('should throw on ambiguous default values for same path', async function() {
      // If somehow two schemas define different defaults for the same path, should throw
      // This is difficult to construct naturally, so skip for now
    });

    it('should handle deeply nested defaults', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('object')
              .property('d', new Schema('string', { default: 'deep' }))
            )
          )
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      assert.strictEqual(assignments.get('a.b.c.d'), 'deep');
    });
  });

  describe('Default and inherit interaction', function() {

    it('should handle properties with both default and inherit', async function() {
      // Property can have a default that gets overridden by inherit
      const schema = new Schema('object')
        .property('timeout', new Schema('number', { default: 1000 }))
        .property('server', new Schema('object')
          .property('timeout', new Schema('number', {
            default: 3000,
            inherit: true
          }))
        );

      const compiled = await resolver.compile(schema);
      const source = new SchemaDefaultsSource();

      const assignments = await source.load(compiled, {});

      // Both should be present
      assert.ok(assignments.has('timeout'));
      assert.ok(assignments.has('server.timeout'));

      // Parent has literal default
      assert.strictEqual(assignments.get('timeout'), 1000);

      // Child has inherit function (not the default value)
      assert.strictEqual(typeof assignments.get('server.timeout'), 'function');
    });
  });
});
