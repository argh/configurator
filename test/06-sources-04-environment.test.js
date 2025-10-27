
import { strict as assert } from 'assert';
import { Schema } from '../src/schema/schema.js';
import { SchemaResolver } from '../src/schema/schema-resolver.js';
import { EnvironmentSource, EnvironmentError } from '../src/configuration-sources/environment-source.js';

describe('Sources - EnvironmentSource', function() {
  let resolver;

  beforeEach(function() {
    resolver = new SchemaResolver();
  });

  describe('Basic environment variable loading', function() {

    it('should load simple properties from environment variables', async function() {
      const schema = new Schema('object')
        .property('name', new Schema('string'))
        .property('port', new Schema('number'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'myapp',
        env: {
          'MYAPP_NAME': 'testapp',
          'MYAPP_PORT': '3000'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('name'), 'testapp');
      assert.strictEqual(assignments.get('port'), '3000');
    });

    it('should load nested properties with underscore-separated paths', async function() {
      const schema = new Schema('object')
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_DATABASE_HOST': 'localhost',
          'APP_DATABASE_PORT': '5432'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('database.host'), 'localhost');
      assert.strictEqual(assignments.get('database.port'), '5432');
    });

    it('should handle camelCase to CONSTANT_CASE conversion', async function() {
      const schema = new Schema('object')
        .property('maxRetries', new Schema('number'))
        .property('isEnabled', new Schema('boolean'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'test',
        env: {
          'TEST_MAX_RETRIES': '5',
          'TEST_IS_ENABLED': 'true'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('maxRetries'), '5');
      assert.strictEqual(assignments.get('isEnabled'), 'true');
    });
  });

  describe('App name prefix handling', function() {

    it('should require app name prefix on environment variables', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'myapp',
        env: {
          'MYAPP_VALUE': 'included',
          'OTHERAPP_VALUE': 'excluded',
          'VALUE': 'excluded'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'included');
      assert.strictEqual(assignments.size, 1);
    });

    it('should work without app name prefix', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        // No appName
        env: {
          'VALUE': 'test'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'test');
    });

    it('should handle redundant app name prefix in schema property', async function() {
      // When schema has property matching app name, avoid FROB_FROB_FOO pattern
      const schema = new Schema('object')
        .property('globalDebug', new Schema('boolean'))
        .property('frob', new Schema('object')
          .property('foo', new Schema('string'))
          .property('bar', new Schema('number'))
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'frob',
        env: {
          'FROB_GLOBAL_DEBUG': 'true',
          'FROB_FOO': 'value1',  // Not FROB_FROB_FOO
          'FROB_BAR': '42'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('globalDebug'), 'true');
      assert.strictEqual(assignments.get('frob.foo'), 'value1');
      assert.strictEqual(assignments.get('frob.bar'), '42');
    });
  });

  describe('Context name configuration', function() {

    it('should use default context name "env"', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'test',
        env: {
          'TEST_VALUE': 'from-env'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'from-env');
    });

    it('should use custom context name', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource({ contextName: 'customEnv' });

      const context = {
        appName: 'test',
        customEnv: {
          'TEST_VALUE': 'custom'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'custom');
    });

    it('should fall back to process.env when context key missing', async function() {
      // Note: Can't easily test process.env without polluting it
      // Just verify it doesn't crash
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'test'
        // No env key - will use process.env
      };

      const assignments = await source.load(compiled, context);

      // Should return empty map if no matching vars in process.env
      assert.ok(assignments instanceof Map);
    });
  });

  describe('Sequence priority', function() {

    it('should have default sequence of ENVIRONMENT', function() {
      const source = new EnvironmentSource();
      assert.strictEqual(source.sequence, 400);
    });

    it('should allow custom sequence override', function() {
      const source = new EnvironmentSource({ sequence: 500 });
      assert.strictEqual(source.sequence, 500);
    });
  });

  describe('Wildcard handling', function() {

    it('should match wildcards in environment variable names', async function() {
      const schema = new Schema('object')
        .property('items', new Schema('array')
          .property('*', new Schema('string'))
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_ITEMS_0': 'first',
          'APP_ITEMS_1': 'second',
          'APP_ITEMS_2': 'third'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('items.0'), 'first');
      assert.strictEqual(assignments.get('items.1'), 'second');
      assert.strictEqual(assignments.get('items.2'), 'third');
    });

    it('should match nested wildcards', async function() {
      const schema = new Schema('object')
        .property('configs', new Schema('object')
          .property('*', new Schema('object')
            .property('enabled', new Schema('boolean'))
          )
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'test',
        env: {
          'TEST_CONFIGS_DEV_ENABLED': 'true',
          'TEST_CONFIGS_PROD_ENABLED': 'false'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('configs.dev.enabled'), 'true');
      assert.strictEqual(assignments.get('configs.prod.enabled'), 'false');
    });
  });

  describe('Strict mode', function() {

    it('should ignore unknown environment variables in non-strict mode', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_KNOWN': 'value',
          'APP_UNKNOWN': 'ignored'
        }
      };

      const assignments = await source.load(compiled, context, { strict: false });

      assert.strictEqual(assignments.get('known'), 'value');
      assert.strictEqual(assignments.size, 1);
    });

    it('should throw on unknown environment variables in strict mode', async function() {
      const schema = new Schema('object')
        .property('known', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_KNOWN': 'value',
          'APP_UNKNOWN': 'error'
        }
      };

      await assert.rejects(
        () => source.load(compiled, context, { strict: true }),
        {
          name: 'EnvironmentError',
          message: /Unexpected environment variable.*APP_UNKNOWN/
        }
      );
    });
  });

  describe('Edge cases', function() {

    it('should handle empty environment', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'test',
        env: {}
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.size, 0);
    });

    it('should handle missing context object', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const assignments = await source.load(compiled, {});

      // Falls back to process.env
      assert.ok(assignments instanceof Map);
    });

    it('should handle environment variables with numeric values', async function() {
      const schema = new Schema('object')
        .property('count', new Schema('number'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_COUNT': '123'
        }
      };

      const assignments = await source.load(compiled, context);

      // Source returns string; normalization happens in processAssignments
      assert.strictEqual(assignments.get('count'), '123');
    });

    it('should handle environment variables with boolean-like values', async function() {
      const schema = new Schema('object')
        .property('enabled', new Schema('boolean'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_ENABLED': 'true'
        }
      };

      const assignments = await source.load(compiled, context);

      // Source returns string; normalization happens in processAssignments
      assert.strictEqual(assignments.get('enabled'), 'true');
    });

    it('should handle deeply nested paths', async function() {
      const schema = new Schema('object')
        .property('a', new Schema('object')
          .property('b', new Schema('object')
            .property('c', new Schema('object')
              .property('d', new Schema('string'))
            )
          )
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'app',
        env: {
          'APP_A_B_C_D': 'deep'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('a.b.c.d'), 'deep');
    });

    it('should handle app name with multiple words', async function() {
      const schema = new Schema('object')
        .property('value', new Schema('string'));

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'myGreatApp',
        env: {
          'MY_GREAT_APP_VALUE': 'test'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('value'), 'test');
    });
  });

  describe('Real-world scenarios', function() {

    it('should handle typical application configuration', async function() {
      const schema = new Schema('object')
        .property('port', new Schema('number'))
        .property('database', new Schema('object')
          .property('host', new Schema('string'))
          .property('port', new Schema('number'))
          .property('name', new Schema('string'))
        )
        .property('redis', new Schema('object')
          .property('url', new Schema('string'))
          .property('maxRetries', new Schema('number'))
        );

      const compiled = resolver.compile(schema);
      const source = new EnvironmentSource();

      const context = {
        appName: 'myapp',
        env: {
          'MYAPP_PORT': '8080',
          'MYAPP_DATABASE_HOST': 'db.example.com',
          'MYAPP_DATABASE_PORT': '5432',
          'MYAPP_DATABASE_NAME': 'production',
          'MYAPP_REDIS_URL': 'redis://localhost:6379',
          'MYAPP_REDIS_MAX_RETRIES': '3'
        }
      };

      const assignments = await source.load(compiled, context);

      assert.strictEqual(assignments.get('port'), '8080');
      assert.strictEqual(assignments.get('database.host'), 'db.example.com');
      assert.strictEqual(assignments.get('database.port'), '5432');
      assert.strictEqual(assignments.get('database.name'), 'production');
      assert.strictEqual(assignments.get('redis.url'), 'redis://localhost:6379');
      assert.strictEqual(assignments.get('redis.maxRetries'), '3');
    });
  });
});
