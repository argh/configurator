
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { SchemaError, ValidationError } from '../src/schema/schema-errors.js';
import { EMPTY } from '../src/schema/constants.js';

describe('Assignments - Indirection (inherit, reference)', function() {
  /** @type {SchemaResolver} */
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Schema.inherit()', function() {

    describe('Basic inheritance', function() {

      it('should inherit value from parent with same property name', async function() {
        const schema = new Schema('object')
          .property('env', new Schema('string'))
          .property('database', new Schema('object')
            .property('env', Schema.inherit())
            .property('host', new Schema('string'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['env', 'production'],
          ['database.host', 'db.example.com']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.env, 'production');
        assert.strictEqual(result.database.env, 'production');
        assert.strictEqual(result.database.host, 'db.example.com');
      });

      it('should inherit value using explicit property name', async function() {
        const schema = new Schema('object')
          .property('environment', new Schema('string'))
          .property('service', new Schema('object')
            .property('env', Schema.inherit('environment'))
            .property('name', new Schema('string'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['environment', 'staging'],
          ['service.name', 'api-server']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.environment, 'staging');
        assert.strictEqual(result.service.env, 'staging');
      });

      it('should inherit from grandparent when parent does not have property', async function() {
        const schema = new Schema('object')
          .property('timeout', new Schema('number'))
          .property('services', new Schema('object')
            .property('api', new Schema('object')
              .property('timeout', Schema.inherit())
              .property('url', new Schema('string'))
            )
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['timeout', 5000],
          ['services.api.url', 'https://api.example.com']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.timeout, 5000);
        assert.strictEqual(result.services.api.timeout, 5000);
      });

      it('should prefer closer ancestor over farther ancestor', async function() {
        const schema = new Schema('object')
          .property('env', new Schema('string'))
          .property('services', new Schema('object')
            .property('env', new Schema('string'))
            .property('api', new Schema('object')
              .property('env', Schema.inherit())
              .property('name', new Schema('string'))
            )
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['env', 'production'],
          ['services.env', 'development'],
          ['services.api.name', 'my-api']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.env, 'production');
        assert.strictEqual(result.services.env, 'development');
        // Should inherit from services.env (closer), not root env
        assert.strictEqual(result.services.api.env, 'development');
      });
    });

    describe('Shallow behavior (default)', function() {

      it('should NOT populate inherited value when parent container does not exist', async function() {
        const schema = new Schema('object')
          .property('timeout', new Schema('number'))
          .property('database', new Schema('object')
            .property('timeout', Schema.inherit())
            .property('host', new Schema('string'))
          )
          .property('otherProp', new Schema('string'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['timeout', 3000],
          ['otherProp', 'value']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.timeout, 3000);
        assert.strictEqual(result.otherProp, 'value');
        // database container not created, so inherited value not populated
        assert.strictEqual(result.database, undefined);
      });

      it('should populate inherited value when sibling assignment creates container', async function() {
        const schema = new Schema('object')
          .property('env', new Schema('string'))
          .property('server', new Schema('object')
            .property('env', Schema.inherit())
            .property('port', new Schema('number'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['env', 'production'],
          ['server.port', 8080]  // This creates the server container
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.env, 'production');
        assert.strictEqual(result.server.port, 8080);
        // Inherited value populated because container was created
        assert.strictEqual(result.server.env, 'production');
      });
    });

    describe('Deep behavior', function() {

      it('should populate inherited value when parent has deep() option', async function() {
        const schema = new Schema('object')
          .deep()
          .property('env', new Schema('string'))
          .property('database', new Schema('object')
            .deep()
            .property('env', Schema.inherit())
            .property('host', new Schema('string'))
          )
          .property('otherProp', new Schema('string'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['env', 'production'],
          ['otherProp', 'value']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.env, 'production');
        assert.strictEqual(result.otherProp, 'value');
        // database container created due to deep(), inherited value populated
        assert.deepStrictEqual(result.database, { env: 'production' });
      });
    });

    describe('Error cases', function() {

      it('should throw when used at top level (no parent)', async function() {
        const schema = Schema.inherit();

        await assert.rejects(
          async () => {
            const compiled = await resolver.compile(schema);
            await compiled.process({});
          },
          (err) => {
            assert.ok(err?.cause instanceof SchemaError);
            assert.ok(err?.cause.message.includes('top-level'));
            return true;
          }
        );
      });



      it('should throw when property schema not found in any ancestor', async function() {
        const schema = new Schema('object')
          .property('server', new Schema('object')
            .property('missing', Schema.inherit())
            .property('port', new Schema('number'))
          );

        await assert.rejects(
          async () => {
            const compiled = await resolver.compile(schema);
            await compiled.process({server: { port: 123 }})
          },
          (err) => {
            assert.ok(err?.cause instanceof SchemaError);
            assert.ok(err?.cause.message.includes('missing'));
            assert.ok(err?.cause.message.includes('not found in any ancestor'));
            return true;
          }
        );
      });

      it('should return undefined when ancestor property value is not set', async function() {
        // Property schema exists in ancestor, but value is not assigned
        const schema = new Schema('object')
          .property('timeout', new Schema('number'))
          .property('server', new Schema('object')
            .property('timeout', Schema.inherit())
            .property('port', new Schema('number'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['server.port', 8080]
          // Note: 'timeout' at root is NOT assigned
        ]);

        const result = await compiled.processAssignments(assignments);

        // Inherited value is undefined because ancestor value wasn't set
        assert.strictEqual(result.server.timeout, undefined);
        assert.strictEqual(result.server.port, 8080);
      });
    });

    describe('Serialization', function() {

      it('should omit inherited value from serialization', async function() {
        const schema = new Schema('object')
          .property('env', new Schema('string'))
          .property('service', new Schema('object')
            .property('env', Schema.inherit())
            .property('name', new Schema('string'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['env', 'production'],
          ['service.name', 'api']
        ]);

        const result = await compiled.processAssignments(assignments);
        const serialized = await compiled.serialize(result);

        assert.strictEqual(result.service.env, 'production');
        // Inherited value should be omitted from serialization
        assert.strictEqual(serialized.service.env, undefined);
        assert.strictEqual(serialized.service.name, 'api');
      });
    });
  });

  describe('Schema.reference()', function() {

    describe('Basic references', function() {

      it('should get value from explicit path', async function() {
        const schema = new Schema('object')
          .property('primary', new Schema('object')
            .property('host', new Schema('string'))
            .property('port', new Schema('number'))
          )
          .property('replica', new Schema('object')
            .property('host', Schema.reference('primary.host'))
            .property('port', new Schema('number'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['primary.host', 'db-primary.example.com'],
          ['primary.port', 5432],
          ['replica.port', 5433]
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.primary.host, 'db-primary.example.com');
        assert.strictEqual(result.replica.host, 'db-primary.example.com');
      });

      it('should get value from root-level property', async function() {
        const schema = new Schema('object')
          .property('appName', new Schema('string'))
          .property('logging', new Schema('object')
            .property('prefix', Schema.reference('appName'))
            .property('level', new Schema('string'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['appName', 'my-service'],
          ['logging.level', 'debug']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.logging.prefix, 'my-service');
      });

      it('should reference deeply nested properties', async function() {
        const schema = new Schema('object')
          .property('config', new Schema('object')
            .property('database', new Schema('object')
              .property('connection', new Schema('object')
                .property('host', new Schema('string'))
              )
            )
          )
          .property('cache', new Schema('object')
            .property('host', Schema.reference('config.database.connection.host'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['config.database.connection.host', 'localhost'],
          ['cache', EMPTY]  // trigger cache container creation
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.cache.host, 'localhost');
      });
    });

    describe('Shallow behavior (default)', function() {

      it('should NOT populate reference when parent container does not exist', async function() {
        const schema = new Schema('object')
          .property('source', new Schema('string'))
          .property('target', new Schema('object')
            .property('value', Schema.reference('source'))
            .property('name', new Schema('string'))
          )
          .property('other', new Schema('string'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['source', 'hello'],
          ['other', 'world']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.source, 'hello');
        assert.strictEqual(result.other, 'world');
        // target container not created
        assert.strictEqual(result.target, undefined);
      });

      it('should populate reference when sibling assignment creates container', async function() {
        const schema = new Schema('object')
          .property('masterPort', new Schema('number'))
          .property('worker', new Schema('object')
            .property('port', Schema.reference('masterPort'))
            .property('id', new Schema('number'))
          );

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['masterPort', 8080],
          ['worker.id', 1]  // Creates worker container
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.worker.port, 8080);
        assert.strictEqual(result.worker.id, 1);
      });
    });

    describe('Deep behavior', function() {

      it('should populate reference when parent has deep() option', async function() {
        const schema = new Schema('object')
          .deep()
          .property('baseUrl', new Schema('string'))
          .property('api', new Schema('object')
            .deep()
            .property('url', Schema.reference('baseUrl'))
            .property('timeout', new Schema('number'))
          )
          .property('other', new Schema('string'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['baseUrl', 'https://api.example.com'],
          ['other', 'value']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.baseUrl, 'https://api.example.com');
        // api container created due to deep(), reference populated
        assert.deepStrictEqual(result.api, { url: 'https://api.example.com' });
      });
    });

    describe('Error cases', function() {

      it('should throw when reference path does not exist in schema', async function() {
        const schema = new Schema('object')
          .property('target', new Schema('object')
            .property('value', Schema.reference('nonexistent.path'))
          );

        await assert.rejects(
          async () => {
            const compiled = await resolver.compile(schema)
            await compiled.process({target: {}});
          },
          (err) => {
            assert.ok(err?.cause instanceof SchemaError);
            assert.ok(err?.cause.message.includes('Reference path'));
            return true;
          }
        );
      });

      it('should throw when reference path is partially invalid', async function() {
        const schema = new Schema('object')
          .property('source', new Schema('string'))
          .property('target', new Schema('object')
            .property('value', Schema.reference('source.nested'))  // source is string, not object
          );

        await assert.rejects(
          async () => {
            const compiled = await resolver.compile(schema);

            const assignments = new Map([
              ['target', {}]
            ]);
            await compiled.processAssignments(assignments);
          },
          (err) => {
            assert.ok(err?.cause instanceof SchemaError);
            assert.ok(err?.cause.message.includes('Reference path'));
            return true;
          }
        );
      });
    });

    describe('Validation', function() {

      it('should pass validation when reference value matches', async function() {
        const schema = new Schema('object')
          .property('source', new Schema('string'))
          .property('copy', Schema.reference('source'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['source', 'hello']
        ]);

        const result = await compiled.processAssignments(assignments);

        assert.strictEqual(result.source, 'hello');
        assert.strictEqual(result.copy, 'hello');
      });
    });

    describe('Serialization', function() {

      it('should omit reference value from serialization', async function() {
        const schema = new Schema('object')
          .property('primary', new Schema('string'))
          .property('backup', Schema.reference('primary'));

        const compiled = await resolver.compile(schema);

        const assignments = new Map([
          ['primary', 'main-server']
        ]);

        const result = await compiled.processAssignments(assignments);
        const serialized = await compiled.serialize(result);

        assert.strictEqual(result.backup, 'main-server');
        // Reference value should be omitted from serialization
        assert.strictEqual(serialized.backup, undefined);
      });
    });
  });

  describe('Combined scenarios', function() {

    it('should support both inherit and reference in same schema', async function() {
      const schema = new Schema('object')
        .property('env', new Schema('string'))
        .property('globalTimeout', new Schema('number'))
        .property('services', new Schema('object')
          .property('database', new Schema('object')
            .property('env', Schema.inherit())
            .property('timeout', Schema.reference('globalTimeout'))
            .property('host', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['env', 'production'],
        ['globalTimeout', 5000],
        ['services.database.host', 'db.example.com']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.services.database.env, 'production');
      assert.strictEqual(result.services.database.timeout, 5000);
      assert.strictEqual(result.services.database.host, 'db.example.com');
    });

    it('should allow reference to inherited value', async function() {
      const schema = new Schema('object')
        .property('region', new Schema('string'))
        .property('primary', new Schema('object')
          .property('region', Schema.inherit())
          .property('host', new Schema('string'))
        )
        .property('secondary', new Schema('object')
          .property('region', Schema.reference('primary.region'))
          .property('host', new Schema('string'))
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['region', 'us-east-1'],
        ['primary.host', 'primary.example.com'],
        ['secondary.host', 'secondary.example.com']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.region, 'us-east-1');
      assert.strictEqual(result.primary.region, 'us-east-1');
      assert.strictEqual(result.secondary.region, 'us-east-1');
    });

    it('should handle array elements with inheritance', async function() {
      const schema = new Schema('object')
        .property('defaultPort', new Schema('number'))
        .property('servers', new Schema('array')
          .property('*', new Schema('object')
            .property('port', Schema.reference('defaultPort'))
            .property('name', new Schema('string'))
          )
        );

      const compiled = await resolver.compile(schema);

      const assignments = new Map([
        ['defaultPort', 3000],
        ['servers.0.name', 'server-a'],
        ['servers.1.name', 'server-b']
      ]);

      const result = await compiled.processAssignments(assignments);

      assert.strictEqual(result.servers[0].port, 3000);
      assert.strictEqual(result.servers[0].name, 'server-a');
      assert.strictEqual(result.servers[1].port, 3000);
      assert.strictEqual(result.servers[1].name, 'server-b');
    });
  });
});
