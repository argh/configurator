
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { ObjectSource } from '../src/configuration-sources/object-source.js';

describe('Sources - ObjectSource', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic loading', function() {

    it('should load simple properties from object', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          name: 'myapp',
          port: 3000
        }
      };

      const assignments = await source.load(compiled, context);

      assert.ok(assignments instanceof Map);
      assert.strictEqual(assignments.get('name'), 'myapp');
      assert.strictEqual(assignments.get('port'), 3000);
    });

    it('should load nested properties from object', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          database: {
            host: 'localhost',
            port: 5432
          }
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), 5432);
    });

    it('should load array elements as dotted paths', async function() {
      const schema = new Schema('object')
        .property('tags', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          tags: ['javascript', 'node', 'testing']
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('tags.0'), 'javascript');
      assert.strictEqual(assignments.get('tags.1'), 'node');
      assert.strictEqual(assignments.get('tags.2'), 'testing');
    });
  });

  describe('Context name configuration', function() {

    it('should use default context name "data"', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: { value: 'test' }
      };

      const assignments = await source.load(compiled, context);
      assert.strictEqual(assignments.get('value'), 'test');
    });

    it('should use custom context name', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource({ contextName: 'defaults' });

      const context = {
        defaults: { value: 'custom' }
      };

      const assignments = await source.load(compiled, context);
      assert.strictEqual(assignments.get('value'), 'custom');
    });

    it('should return empty assignments when context key missing', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource({ contextName: 'missing' });

      const context = {
        data: { value: 'test' }
      };

      const assignments = await source.load(compiled, context);
      assert.strictEqual(assignments.size, 0);
    });
  });

  describe('Sequence priority', function() {

    it('should have default sequence of APP_DEFAULTS', function() {
      const source = new ObjectSource();
      assert.strictEqual(source.sequence, 300);
    });

    it('should allow custom sequence override', function() {
      const source = new ObjectSource({ sequence: 1000 });
      assert.strictEqual(source.sequence, 1000);
    });
  });

  describe('Complex data structures', function() {

    it('should handle deeply nested objects', async function() {
      const schema = new Schema('object')
        .property('server', new Schema('object')
          .property('database', new Schema('object')
            .property('connection', new Schema('object')
              .property('host', new Schema('string'))
              .property('port', new Schema('number'))
            )
          )
        );

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          server: {
            database: {
              connection: {
                host: 'db.example.com',
                port: 5432
              }
            }
          }
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('server.database.connection.host'), 'db.example.com');
      assert.strictEqual(assignments.get('server.database.connection.port'), 5432);
    });

    it('should handle mixed arrays and objects', async function() {
      const schema = new Schema('object')
        .property('servers', new Schema('array')
          .property('*', new Schema('object')
            .property('host', new Schema('string'))
            .property('port', new Schema('number'))
          )
        );

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          servers: [
            { host: 'server1.com', port: 80 },
            { host: 'server2.com', port: 443 }
          ]
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('servers.0.host'), 'server1.com');
      assert.strictEqual(assignments.get('servers.0.port'), 80);
      assert.strictEqual(assignments.get('servers.1.host'), 'server2.com');
      assert.strictEqual(assignments.get('servers.1.port'), 443);
    });

    it('should handle empty objects', async function() {
      const schema = new Schema('object')
        .property('config', new Schema('object')
          .property('value', new Schema('string'))
        );

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {}
      };

      const assignments = await source.load(compiled, context);
      assert.strictEqual(assignments.size, 0);
    });

    it('should handle null values', async function() {
      const schema = new Schema('object')
        .property('optional', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          optional: null
        }
      };

      const assignments = await source.load(compiled, context);
      assert.strictEqual(assignments.get('optional'), null);
    });
  });

  describe('Edge cases', function() {

    it('should handle empty context object', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const assignments = await source.load(compiled, {});
      assert.strictEqual(assignments.size, 0);
    });

    it('should include properties not in schema', async function() {
      // toAssignments returns all properties from the object, even those not in schema
      // (they will be filtered out later during strict mode validation)
      const schema = new Schema('object')
        .property('name', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new ObjectSource();

      const context = {
        data: {
          name: 'test',
          unknown: 'included'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.ok(assignments.has('name'));
      assert.ok(assignments.has('unknown'));
      assert.strictEqual(assignments.get('unknown'), 'included');
    });
  });
});
