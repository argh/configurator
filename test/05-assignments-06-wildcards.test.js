
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';

describe.skip('Assignments - Wildcard Expansion', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Simple wildcard default expansion', function() {

    it('should expand wildcard string defaults to concrete array indices', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string').default('default-string'))
        );

      const compiled = await resolver.compile(schema);

      // Wildcard only expands to existing concrete paths
      // If we have items.0, items.1, items.2 as concrete paths, wildcard won't add new values
      const assignments = new Map([
        ['items.0', 'custom-value'],
        ['items.1', 'another-value'],
        ['items.2', 'third-value'],
        ['items.*', 'default-string']  // Wildcard default (won't override concrete values)
      ]);

      const result = await compiled.processAssignments(assignments);

      // All indices have explicit values, wildcard doesn't override
      assert.deepStrictEqual(result, {
        items: ['custom-value', 'another-value', 'third-value']
      });
    });

    it('should expand wildcard defaults when only some indices have values', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string').default('untagged'))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['tags.0', 'important'],
        ['tags.1', 'urgent']
        // indices 0 and 1 have explicit values, but no wildcard default here
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        tags: ['important', 'urgent']
      });
    });

    it('should not expand wildcard defaults without concrete paths', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string').default('default-string'))
        );

      const compiled = await resolver.compile(schema);

      // Only wildcard assignment, no concrete paths
      const assignments = new Map([
        ['items.*', 'default-string']
      ]);

      const result = await compiled.processAssignments(assignments) ?? {};

      // Should not create any array elements
      assert.deepStrictEqual(result, {});
    });

  });

  describe('Wildcard defaults with nested objects', function() {

    it('should expand wildcard defaults for array of objects', async function() {
      const schema = new Schema('object')
        .property('points', new Schema('array')
          .property('*', new Schema('object')
            .property('x', new Schema('number').default(0))
            .property('y', new Schema('number').default(0))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['points.0.x', 5],
        ['points.1.y', 10],
        ['points.2.x', 15],
        ['points.2.y', 20],
        // Wildcard defaults should apply
        ['points.*.x', 0],
        ['points.*.y', 0]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        points: [
          { x: 5, y: 0 },   // x explicit, y from default
          { x: 0, y: 10 },  // x from default, y explicit
          { x: 15, y: 20 }  // both explicit
        ]
      });
    });

    it('should expand nested wildcard defaults deeply', async function() {
      const schema = new Schema('object')
        .property('matrix', new Schema('array')
          .property('*', new Schema('object')
            .property('row', new Schema('number').default(0))
            .property('col', new Schema('number').default(0))
            .property('value', new Schema('number').default(1))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['matrix.0.row', 0],
        ['matrix.0.col', 0],
        // value should use default
        ['matrix.1.row', 1],
        ['matrix.1.col', 1],
        ['matrix.1.value', 99],
        // Defaults
        ['matrix.*.row', 0],
        ['matrix.*.col', 0],
        ['matrix.*.value', 1]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        matrix: [
          { row: 0, col: 0, value: 1 },   // value from default
          { row: 1, col: 1, value: 99 }   // all explicit
        ]
      });
    });

  });

  describe('Wildcard defaults with unions', function() {

    it('should expand wildcard defaults for union members', async function() {
      const schema = new Schema('object')
        .property('various', new Schema('array')
          .property('*', new Schema('any')
            .unionDiscriminator(value => (value ? `${typeof value}-key` : 'object-key'))
            .unionSchema('string-key', new Schema('string'))
            .unionSchema('number-key', new Schema('number'))
            .unionSchema('object-key', new Schema('object')
              .property('filename', new Schema('string'))
              .property('encoding', new Schema('string').default('base64'))
            )
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['various.0', 'simple-string'],
        ['various.1.filename', 'file1.txt'],
        ['various.2.filename', 'file2.txt'],
        ['various.2.encoding', 'utf8'],
        // Wildcard default for encoding
        ['various.*:object-key.encoding', 'base64'],
        ['various.3', 'simple-number']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.various[0], 'simple-string');
      assert.deepStrictEqual(result.various[1], { filename: 'file1.txt', encoding: 'base64' });
      assert.deepStrictEqual(result.various[2], { filename: 'file2.txt', encoding: 'utf8' });
    });

    it('should expand wildcard union defaults with discriminator', async function() {
      const schema = new Schema('object')
        .property('configs', new Schema('array')
          .property('*', new Schema('object')
            .property('type', new Schema('string').unionKey())
            .unionSchema('database', new Schema('object')
              .property('type', Schema.literal('database'))
              .property('host', new Schema('string').default('localhost'))
              .property('port', new Schema('number').default(5432))
            )
            .unionSchema('cache', new Schema('object')
              .property('type', Schema.literal('cache'))
              .property('host', new Schema('string').default('localhost'))
              .property('ttl', new Schema('number').default(3600))
            )
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['configs.0.type', 'database'],
        ['configs.0.host', 'db.example.com'],
        ['configs.1.type', 'cache'],
        // Wildcard defaults
        ['configs.*:database.host', 'localhost'],
        ['configs.*:database.port', 5432],
        ['configs.*:cache.host', 'localhost'],
        ['configs.*:cache.ttl', 3600]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        configs: [
          { type: 'database', host: 'db.example.com', port: 5432 },  // host explicit, port from default
          { type: 'cache', host: 'localhost', ttl: 3600 }            // both from defaults
        ]
      });
    });

    it('should not expand wildcard with conflicting union keys', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('type', new Schema('string').unionKey())
            .unionSchema('a', new Schema('object')
              .property('type', Schema.literal('a'))
              .property('value', new Schema('string').default('default-a'))
            )
            .unionSchema('b', new Schema('object')
              .property('type', Schema.literal('b'))
              .property('value', new Schema('string').default('default-b'))
            )
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['items.0.type', 'a'],
        ['items.1.type', 'b'],
        // Wildcard with union key 'a' should only expand to items.0
        ['items.*:a.value', 'default-a'],
        // Wildcard with union key 'b' should only expand to items.1
        ['items.*:b.value', 'default-b']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        items: [
          { type: 'a', value: 'default-a' },
          { type: 'b', value: 'default-b' }
        ]
      });
    });

  });

  describe('Edge cases', function() {

    it('should handle multiple wildcards at different levels', async function() {
      const schema = new Schema('object')
        .property('grid', new Schema('array')
          .property('*', new Schema('array')
            .property('*', new Schema('number').default(0))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['grid.0.0', 1],
        ['grid.0.1', 2],
        ['grid.1.0', 3],
        ['grid.1.1', 4],
        ['grid.1.2', 5],
        // Wildcard defaults - expands to existing paths but won't override explicit values
        ['grid.*.*', 0]
      ]);

      const result = await compiled.processAssignments(assignments);

      // All values are explicit, wildcard doesn't override
      assert.deepStrictEqual(result, {
        grid: [
          [1, 2],
          [3, 4, 5]
        ]
      });
    });

    it('should handle wildcards in object properties', async function() {
      const schema = new Schema('object')
        .property('data', new Schema('object')
          .property('*', new Schema('string').default('unknown'))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['data.field1', 'value1'],
        ['data.field2', 'value2'],
        ['data.*', 'fallback']
        // Note: The wildcard will expand to data.field1 and data.field2, but those are
        // already explicit assignments so they won't be overridden. Wildcards can only
        // match in the middle of paths, never as leaf elements (which would always conflict
        // with explicit assignments at that path).
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        data: {
          field1: 'value1',
          field2: 'value2'
        }
      });
    });

    it('should prioritize explicit values over wildcard defaults', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('object')
            .property('name', new Schema('string').default('unnamed'))
            .property('count', new Schema('number').default(0))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['items.0.name', 'explicit-name'],
        ['items.0.count', 42],
        ['items.1.name', 'another-name'],
        // Wildcard defaults
        ['items.*.name', 'unnamed'],
        ['items.*.count', 0]
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.deepStrictEqual(result, {
        items: [
          { name: 'explicit-name', count: 42 },  // Both explicit
          { name: 'another-name', count: 0 }     // count from wildcard default
        ]
      });
    });

  });

});
